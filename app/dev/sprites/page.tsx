import { notFound } from 'next/navigation';
import SpriteSheet from './SpriteSheet';

// Development-only page for checking the game art and hitboxes.
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <SpriteSheet />;
}
