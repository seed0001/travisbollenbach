# The Colossus — the venue at the end of the street

**Routes:** `/rabbit-hole/venue` (the room picker), `/rabbit-hole/arena` (Game Arena), `/rabbit-hole/theater` (Movie Theater) · **Components:** [`VenueChoice`](../src/components/VenueChoice.tsx), [`ArenaLobby`](../src/components/ArenaLobby.tsx), [`MovieTheater`](../src/components/MovieTheater.tsx)

The monolith that closes off the Construct's street. One dome, three rooms: a game arena, a concert hall, and a movie theater. Pressing **E** at the entrance on the street (or visiting `/rabbit-hole/venue` directly) lands you on the room picker.

## The room picker

A flat page of three animated door cards — **Game Arena** ("a domed lobby ringed with game pods"), **Concert Hall** ("a hall in the round: a sunken center stage, tiers climbing outward"), and **Movie Theater** ("bring your own film — it plays for the whole house") — each in its own accent color, plus a "back to the street" link. The Concert Hall is big enough to get [its own page](07-concert-hall.md); the other two rooms are below.

## The Game Arena

**Route:** `/rabbit-hole/arena` · rendered fresh on every visit (`force-dynamic`)

A domed hall under a starfield: a dark disc floor ringed with neon circles, a low wall, a wireframe geodesic shell overhead, and **ten game pods** arranged in a ring — each a pedestal with a pulsing beam of light and a portrait sign (status pill, game name, word-wrapped tagline) facing the center.

The pods are not hardcoded: **each of the ten street units owns one pod**, and the unit's owner names it, taglines it, and points it at an external game URL from their [studio back office](09-accounts-studios-admin.md#the-studio-back-office). The page reads live studio ownership on every visit (`getPublicArenaGames()` in [`src/lib/studios.ts`](../src/lib/studios.ts)), so a newly configured pod appears without a deploy:

- A pod with a URL reads **ENTER / "ready to play"** — pressing **E** (or "Step into the light") leaves the site for the owner's game, which runs on their own host.
- A pod without one reads **COMING SOON** — pressing E just pops a "coming soon" toast.

A pod's accent color matches its unit's storefront on the street. Exits lead "back to the street." The dome's marquee and entrance copy are edited under `arena` in [`src/lib/content.ts`](../src/lib/content.ts) (the old hardcoded `arena.games` list in that file is unused — kept only as a shape reference).

## The Movie Theater

**Route:** `/rabbit-hole/theater`

A single-screen cinema in the same unlit-neon language: a giant screen flanked by dark-red curtains, a "NOW SHOWING" marquee, ten stepped rows of instanced seats climbing toward the back, a center aisle with strip lights, wall sconces, and a starfield ceiling. You spawn at the back and can walk down the steps — the camera rides them smoothly. Idle, the screen reads **"COLOSSUS CINEMA — open the screen menu to start a film."**

The screen is a real video surface. The **screen menu** (top bar) offers:

- **Play a video file** — any local video plays directly off your device; nothing is uploaded.
- **Stream a direct video URL** — a direct `.mp4`/`.webm` link (not a YouTube page; the host must allow cross-site playback).

When a film plays, the house trim lights dim to about a fifth of their brightness; on pause or credits they come back up, with statuses like "Now showing · …", "Intermission · …", and "The credits rolled — pick another film." A **play/pause film** button sits next to the menu. It's bring-your-own-cinema — the site ships no films. Exits lead back to the Colossus room picker.

## Notes

- Both rooms use the site's standard first-person controls; the Arena also supports gyro look on touch.
- The Arena clamps movement inside the dome; the Theater clamps to the room and steps.
