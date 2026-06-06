//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import React from "react";
import {useNavigate} from "react-router-dom";
import {Token} from "../utils";
import {msalInstance} from "../msalInstance";

export default function Logout({onLogout}) {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (window.confirm('Are you sure you want to sign out?')) {
      Token.remove();
      onLogout && onLogout();
      // Also sign out of Microsoft so the user is prompted to choose an account next time.
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.logoutPopup({account: accounts[0], postLogoutRedirectUri: window.location.origin + '/blank.html'}).catch(() => {});
      }
    }

    navigate('/routers-login');
  }, [navigate, onLogout]);

  return <div style={{padding: 16}}>Logout</div>;
}
