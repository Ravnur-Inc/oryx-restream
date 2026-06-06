//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import {Container, TextInput, Button, Stack, Group} from "@mantine/core";
import React from "react";
import axios from "axios";
import {Token, Tools} from "../utils";
import {useNavigate} from "react-router-dom";
import {SrsErrorBoundary} from "../components/SrsErrorBoundary";
import {useErrorBoundary} from "react-error-boundary";
import {useTranslation} from "react-i18next";
import {v4 as uuidv4} from "uuid";

export default function Setup({onInit}) {
  return (
    <SrsErrorBoundary>
      <SetupImpl onInit={onInit} />
    </SrsErrorBoundary>
  );
}

function SetupImpl({onInit}) {
  const [password, setPassword] = React.useState();
  const [initializing, setInitializing] = React.useState();
  const [enabled, setEnabled] = React.useState(false);
  const navigate = useNavigate();
  const {showBoundary: handleError} = useErrorBoundary();
  const {t} = useTranslation();

  // Generate password if not initialized.
  React.useEffect(() => {
    setPassword(uuidv4().replace(/-/g, '').slice(-16));
  }, []);

  // User click login button.
  const handleLogin = React.useCallback((e) => {
    e.preventDefault();

    if (initializing) return;
    setInitializing(true);

    axios.post('/terraform/v1/mgmt/init', {
      password,
    }).then(res => {
      const data = res.data.data;
      console.log(`Init: OK, token is ${Tools.mask(data)}`);
      Token.save(data);
      onInit && onInit();
      navigate('/routers-channels');
    }).catch(handleError);
  }, [handleError, navigate, password, initializing, onInit]);

  React.useEffect(() => {
    axios.get('/terraform/v1/mgmt/check').then(res => {
      setEnabled(!res.data?.data?.upgrading);
      console.log(`Check ok, ${JSON.stringify(res.data)}`);
    }).catch(handleError);
  }, [handleError]);

  return (
    <Container size="sm" mt="xl">
      <form onSubmit={handleLogin}>
        <Stack>
          <TextInput
            label={t('setup.passwordLabel')}
            type={initializing ? 'password' : 'text'}
            placeholder="Password"
            defaultValue={password}
            onChange={(e) => setPassword(e.target.value)}
            description={`* ${t('setup.passwordTip')}`}
          />
          <Group>
            <Button type="submit" disabled={!enabled} loading={!!initializing} onClick={handleLogin}>
              {initializing ? t('setup.labelInit') : t('setup.labelNormal')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Container>
  );
}

