// Seeded media lives in the Vite public directory. Client-hosted HTTPS images
// and unrelated paths retain their configured origin.
export function imageSrc(path: string) {
  return path.startsWith("/images/")
    ? import.meta.env.BASE_URL + path.slice(1)
    : path;
}
