import { apicraft } from '@siberiacancode/apicraft';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');

export default apicraft([
  {
    input: env.APP_API_URL || '',
    output: './src/shared/api/',
    instance: 'fetches',
    nameBy: 'path',
    groupBy: 'class'
  }
]);