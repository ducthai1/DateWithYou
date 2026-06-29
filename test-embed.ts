import { parseEmbed } from "./src/lib/embed";

console.log("YouTube 1:", parseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
console.log("YouTube 2:", parseEmbed("https://youtu.be/dQw4w9WgXcQ"));
console.log("Spotify 1:", parseEmbed("https://open.spotify.com/track/303G4qZ2Gj45tH61G2P6mN"));
console.log("Spotify 2:", parseEmbed("https://open.spotify.com/intl-vi/track/303G4qZ2Gj45tH61G2P6mN?si=abc"));
console.log("TikTok 1:", parseEmbed("https://www.tiktok.com/@user/video/1234567890"));
console.log("TikTok 2:", parseEmbed("https://vt.tiktok.com/ZSjR1234/"));

