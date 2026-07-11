# The Colossus — the venue at the end of the street

**Routes:** `/rabbit-hole/venue` (the door), `/rabbit-hole/arena` (Game Arena), `/rabbit-hole/theater` (Movie Theater) · **Components:** [`VenueChoice`](../src/components/VenueChoice.tsx), [`ArenaLobby`](../src/components/ArenaLobby.tsx), [`MovieTheater`](../src/components/MovieTheater.tsx)

The monolith that closes off the Construct's street. One dome, three rooms: a game arena, a concert hall, and a movie theater. Stepping inside from the street (or visiting `/rabbit-hole/venue` directly) lands you on the room picker.

## The venue choice

A three-door landing: **Game Arena** ("a domed lobby ringed with game pods"), **Concert Hall** ("a hall in the round with a sunken center stage"), and **Movie Theater** ("bring your own film — it plays for the whole house"). Each door carries its own accent color and routes to its room. The Concert Hall is big enough to get [its own page](07-concert-hall.md); the other two rooms are below.

## The Game Arena

**Route:** `/rabbit-hole/arena`

A domed hall ringed with game pods — each pod a doorway into a different 3D world. Walk up to one and step into the light to drop into its game.

The pods are not hardcoded: **each of the ten street storefronts owns one pod**, and the unit's owner names it, taglines it, and points it at an external game URL from their [studio back office](09-accounts-studios-admin.md#the-studio-back-office). The arena page reads live studio ownership on every visit (`getPublicArenaGames()` in [`src/lib/studios.ts`](../src/lib/studios.ts)), so a newly configured pod appears without a deploy:

- A pod with a URL reads **live** — stepping into its light sends you to the game.
- A pod without one reads **soon** — a lit placeholder holding the unit's spot.

Each pod hangs a portrait sign overhead: status pill, game name, and wrapped tagline, in the owner's accent color. The dome's marquee and entrance copy are edited under `arena` in [`src/lib/content.ts`](../src/lib/content.ts).

## The Movie Theater

**Route:** `/rabbit-hole/theater`

A single-screen cinema in the same unlit-neon language as the rest of the venue: a giant screen flanked by curtains, stepped rows of seats climbing toward the back, a center aisle with strip lights, and a starfield ceiling.

The screen is a real video surface. At the screen menu you can:

- **Pick a local video file** — plays directly off your machine; nothing is uploaded.
- **Paste a direct video URL** — any direct media URL plays on the big screen.

When a film starts, the house trim lights dim; when it ends, they come back up. It's bring-your-own-cinema — the site ships no films of its own.

## Notes

- All three rooms share the site's standard first-person controls (WASD/arrows + mouse, touch thumbs + gyro, **E** to interact).
- Exits in each room lead back to the venue door and the street, so you can hop between rooms without leaving the world.
