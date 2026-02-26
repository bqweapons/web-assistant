import { bootstrapBackground } from './background/bootstrap';

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
  bootstrapBackground();
});
