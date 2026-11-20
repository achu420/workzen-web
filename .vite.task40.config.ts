import appConfig from './vite.config.ts';

const backend = 'http://127.0.0.1:45250';

export default async (environment: { command: string; mode: string }) => {
  const config = await appConfig(environment);

  if (!config.server) throw new Error('Vite server configuration is required');

  config.server.host = '127.0.0.1';
  config.server.port = 45251;
  config.server.strictPort = true;
  config.server.proxy = {
    ...config.server.proxy,
    '/api': { target: backend, changeOrigin: true },
    '/ws': { target: backend, changeOrigin: true, ws: true },
    '/gotrue': {
      target: backend,
      changeOrigin: true,
      rewrite: (requestPath: string) => requestPath.replace(/^\/gotrue/, ''),
    },
  };

  return config;
};
