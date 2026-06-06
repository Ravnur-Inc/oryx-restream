//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import React from "react";
import {ErrorBoundary} from 'react-error-boundary';
import {Errors} from "../utils";
import {NavLink} from "react-router-dom";
import {useTranslation} from "react-i18next";

export function SrsErrorBoundary({children}) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <>{children}</>
    </ErrorBoundary>
  );
}

function ErrorFallback({error, resetErrorBoundary}) {
  const [show, setShow] = React.useState(true);

  const onResetError = React.useCallback(() => {
    setShow(false);
    resetErrorBoundary();
  }, [setShow, resetErrorBoundary]);

  if (!show) return <></>;
  // Provider-independent (plain HTML) so the fallback renders even if the error
  // is in the MantineProvider tree itself.
  return (
    <div style={{padding: 16, maxWidth: 900, margin: "0 auto", fontFamily: "'Public Sans', sans-serif"}}>
      <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "16px 18px"}}>
        <h3 style={{margin: "0 0 8px", color: "#b91c1c"}}>You got an error!</h3>
        <ErrorDetail error={error} />
        <button type="button" onClick={onResetError} style={{marginTop: 10, padding: "6px 16px", background: "#15803d", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700}}>OK</button>
      </div>
    </div>
  );
}

function ErrorDetail({error}) {
  const {t} = useTranslation();

  if (!error) return (
    <p>Empty unknown error</p>
  );

  const err = error?.response?.data;
  if (err?.code === Errors.auth || err?.code === Errors.redis || err?.code === Errors.btHttps) {
    return (
      <>
        {
          err?.code === Errors.auth &&
          <p>{t('errs.expire1')}<NavLink to='/routers-logout'>{t('errs.expire2')}</NavLink></p>
        }
        { err?.code === Errors.redis && <p>{t('errs.redis1')}</p> }
        { err?.code === Errors.btHttps && <p>{t('errs.btHttps1')}</p> }
        <p>
          Error Code: {err?.code}
        </p>
        <p>
          <pre style={{whiteSpace: 'pre-wrap'}}>{err?.data?.message}</pre>
        </p>
      </>
    );
  }

  if (err?.code) return (
    <div>
      <p>
        Request: {`${error.request?.responseURL}`} <br/>
        Status: {`${error.response?.status}`} {`${error.response?.statusText}`} <br/>
        Code: {`${err?.code}`} <br/>
        Message: {`${err?.data?.message}`} <br/> <br/>
      </p>
      <pre>
        {JSON.stringify(error.response.data, null, 2)}
      </pre>
    </div>
  );

  if (error.response?.status) {
    return (
      <p>
        Request: {`${error.request?.responseURL}`} <br/>
        Status: {`${error.response?.status}`} {`${error.response?.statusText}`} <br/>
        Data: {`${err}`}
      </p>
    );
  }

  if (error instanceof Error) {
    return (
      <div>
        <p>
          Name: {error.name} <br/>
          Message: {error.message} <br/> <br/>
        </p>
        <pre>
          {error.stack}
        </pre>
      </div>
    );
  }

  if (typeof(error) === 'object') {
    return <p>Object: {JSON.stringify(error)}</p>
  }

  if (typeof(error) === 'function') {
    return <p>Function: {error.toString()}</p>
  }

  return <p>{error.toString()}</p>;
}

