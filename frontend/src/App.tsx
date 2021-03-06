import React, { FC } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import {
  Home,
  Login,
  Register,
  Dashboard,
  ForgotPassword,
  ResetPassword,
  ForgotPasswordEmailSent,
} from './pages';
import { Theme } from './Theme';
import { client } from './graphql/client';

export const App: FC = () => (
  <ApolloProvider client={client}>
    <Theme>
      <Router>
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route path="/login">
            <Login />
          </Route>
          <Route path="/register">
            <Register />
          </Route>
          <Route path="/forgotPassword">
            <ForgotPassword />
          </Route>
          <Route path="/forgotPasswordEmailSent">
            <ForgotPasswordEmailSent />
          </Route>
          <Route path="/resetPassword">
            <ResetPassword />
          </Route>
          <Route path="/app">
            <Dashboard />
          </Route>
        </Switch>
      </Router>
    </Theme>
  </ApolloProvider>
);
