//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import React from 'react';
import {Container, Alert, Button, Group} from '@mantine/core';
import {useNavigate} from 'react-router-dom';
import {msalInstance} from '../msalInstance';
import {Token} from '../utils';

export default function Forbidden() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    Token.remove();
    // Sign out of MSAL so the user can try a different account.
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.logoutPopup({account: accounts[0], postLogoutRedirectUri: window.location.origin + '/blank.html'}).catch(() => {});
    }
    navigate('/routers-login');
  };

  return (
    <Container size="sm" mt="xl">
      <Alert color="red" title="Access Denied">
        <p>
          Your Microsoft account is not registered as a user of this application.
          Please contact an administrator to request access.
        </p>
        <Group justify="flex-end" mt="md">
          <Button color="red" variant="outline" onClick={handleSignOut}>
            Sign out and try a different account
          </Button>
        </Group>
      </Alert>
    </Container>
  );
}
