import { createApp } from './app.js';
import { config } from './lib/config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Spotify Organizer server listening on http://127.0.0.1:${config.port}`);
});
