// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io/ioutil"
	"math/big"
	"os"
	"os/exec"
	"path"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/ossrs/go-oryx-lib/errors"
	"github.com/ossrs/go-oryx-lib/logger"
)

var certManager *CertManager

type CertManager struct {
	// httpsCertificate is the certificate for the server.
	httpsCertificate *tls.Certificate

	// httpCertificateReload is used to reload the certificate.
	httpCertificateReload chan bool

	// certFileLock is used to lock the cert file nginx.key and nginx.crt.
	certFileLock sync.Mutex
}

func NewCertManager() *CertManager {
	return &CertManager{
		httpCertificateReload: make(chan bool, 1),
	}
}

func (v *CertManager) Initialize(ctx context.Context) error {
	if envSelfSignedCertificate() == "on" {
		if err := v.createSelfSignCertificate(ctx); err != nil {
			return errors.Wrapf(err, "create self-signed certificate")
		}
	}

	return nil
}

func (v *CertManager) createSelfSignCertificate(ctx context.Context) error {
	var noKeyFile, noCrtFile bool
	func() {
		v.certFileLock.Lock()
		defer v.certFileLock.Unlock()

		keyFile := path.Join(conf.Pwd, "containers/data/config/nginx.key")
		crtFile := path.Join(conf.Pwd, "containers/data/config/nginx.crt")

		if _, err := os.Stat(keyFile); os.IsNotExist(err) {
			noKeyFile = true
		}
		if _, err := os.Stat(crtFile); os.IsNotExist(err) {
			noCrtFile = true
		}
	}()
	if !noKeyFile || !noCrtFile {
		logger.Tf(ctx, "cert: ignore for cert file exists")
		return nil
	}

	var key, crt string
	if true {
		privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return errors.Wrapf(err, "generate ecdsa key")
		}

		template := x509.Certificate{
			SerialNumber: big.NewInt(1),
			Subject: pkix.Name{
				CommonName: "srs.stack.local",
			},
			NotBefore: time.Now(),
			NotAfter:  time.Now().AddDate(10, 0, 0),
			KeyUsage:  x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
			ExtKeyUsage: []x509.ExtKeyUsage{
				x509.ExtKeyUsageServerAuth,
			},
			BasicConstraintsValid: true,
		}

		derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
		if err != nil {
			return errors.Wrapf(err, "create certificate")
		}

		privateKeyBytes, err := x509.MarshalECPrivateKey(privateKey)
		if err != nil {
			return errors.Wrapf(err, "marshal ecdsa key")
		}

		privateKeyBlock := pem.Block{
			Type:  "EC PRIVATE KEY",
			Bytes: privateKeyBytes,
		}
		key = string(pem.EncodeToMemory(&privateKeyBlock))

		certBlock := pem.Block{
			Type:  "CERTIFICATE",
			Bytes: derBytes,
		}
		crt = string(pem.EncodeToMemory(&certBlock))
		logger.Tf(ctx, "cert: create self-signed certificate ok, key=%vB, crt=%vB", len(key), len(crt))
	}

	if err := v.updateSslFiles(ctx, key+"\n", crt+"\n"); err != nil {
		return errors.Wrapf(err, "updateSslFiles key=%vB, crt=%vB", len(key), len(crt))
	}

	if err := rdb.Set(ctx, SRS_HTTPS, "ssl", 0).Err(); err != nil && err != redis.Nil {
		return errors.Wrapf(err, "set %v %v", SRS_HTTPS, "ssl")
	}

	if err := nginxGenerateConfig(ctx); err != nil {
		return errors.Wrapf(err, "nginx config and reload")
	}
	logger.T(ctx, "cert: update self-signed certificate ok, key=%vB, crt=%vB", len(key), len(crt))

	return nil
}

func (v *CertManager) ReloadCertificate(ctx context.Context) {
	select {
	case v.httpCertificateReload <- true:
	case <-ctx.Done():
	default:
	}
}

func (v *CertManager) reloadCertificateFile(ctx context.Context) error {
	v.certFileLock.Lock()
	defer v.certFileLock.Unlock()

	keyFile := path.Join(conf.Pwd, "containers/data/config/nginx.key")
	crtFile := path.Join(conf.Pwd, "containers/data/config/nginx.crt")

	var noKeyFile, noCrtFile bool
	if _, err := os.Stat(keyFile); os.IsNotExist(err) {
		noKeyFile = true
	}
	if _, err := os.Stat(crtFile); os.IsNotExist(err) {
		noCrtFile = true
	}
	if noKeyFile || noCrtFile {
		logger.Tf(ctx, "cert: ignore for no cert file")
		return nil
	}

	cert, err := tls.LoadX509KeyPair(crtFile, keyFile)
	if err != nil {
		logger.Tf(ctx, "cert: ignore load cert %v, key %v failed", crtFile, keyFile)
		return nil
	}

	v.httpsCertificate = &cert
	logger.Tf(ctx, "cert: reload certificate file ok")

	return nil
}

func (v *CertManager) QueryCertificate() (string, string, error) {
	v.certFileLock.Lock()
	defer v.certFileLock.Unlock()

	keyFile := path.Join(conf.Pwd, "containers/data/config/nginx.key")
	crtFile := path.Join(conf.Pwd, "containers/data/config/nginx.crt")

	key, err := ioutil.ReadFile(keyFile)
	if err != nil {
		return "", "", errors.Wrapf(err, "read key %v", keyFile)
	}

	crt, err := ioutil.ReadFile(crtFile)
	if err != nil {
		return "", "", errors.Wrapf(err, "read crt %v", crtFile)
	}

	return string(key), string(crt), nil
}

// updateSslFiles update the ssl files.
func (v *CertManager) updateSslFiles(ctx context.Context, key, crt string) error {
	v.certFileLock.Lock()
	defer v.certFileLock.Unlock()

	keyFile := path.Join(conf.Pwd, "containers/data/config/nginx.key")
	crtFile := path.Join(conf.Pwd, "containers/data/config/nginx.crt")

	if err := exec.CommandContext(ctx, "rm", "-f", keyFile, crtFile).Run(); err != nil {
		return errors.Wrapf(err, "rm -f %v %v", keyFile, crtFile)
	}

	if err := ioutil.WriteFile(keyFile, []byte(key), 0644); err != nil {
		return errors.Wrapf(err, "write key %vB to %v", len(key), keyFile)
	}

	if err := ioutil.WriteFile(crtFile, []byte(crt), 0644); err != nil {
		return errors.Wrapf(err, "write crt %vB to %v", len(crt), crtFile)
	}

	return nil
}
