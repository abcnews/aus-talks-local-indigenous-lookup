import acto from '@abcnews/alternating-case-to-object';
import { whenDOMReady } from '@abcnews/env-utils';
import { getMountValue, selectMounts } from '@abcnews/mount-utils';
import type { Mount } from '@abcnews/mount-utils';
import React from 'react';
import { render } from 'react-dom';
import App from './components/App';
import type { AppProps } from './components/App';

let appMountEl: Mount;
let appProps: AppProps;

function renderApp() {
  render(<App {...appProps} />, appMountEl);
}

whenDOMReady.then(() => {
  [appMountEl] = selectMounts('austalkslocalindigenouslookup');

  if (appMountEl) {
    appProps = acto(getMountValue(appMountEl)) as AppProps;
    renderApp();
  }
});

if (module.hot) {
  module.hot.accept('./components/App', () => {
    try {
      renderApp();
    } catch (err) {
      import('./components/ErrorBox').then(({ default: ErrorBox }) => {
        render(<ErrorBox error={err} />, appMountEl);
      });
    }
  });
}

if (process.env.NODE_ENV === 'development') {
  console.debug(`[aus-talks-local-indigenous-lookup] public path: ${__webpack_public_path__}`);
}
