import { config } from './config';
import { createApp } from './app';

const server = createApp().listen(config.port, () => {
  console.log(`Chat backend listening on http://localhost:${config.port}`);
});

