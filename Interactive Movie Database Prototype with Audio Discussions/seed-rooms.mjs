/**
 * Seed room related links and update room movie/person associations
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Get key movies and persons
const [movies] = await db.execute('SELECT id, title, slug, posterUrl FROM movies WHERE title IN (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
  'Inception', 'Interstellar', 'The Dark Knight', 'Dumb and Dumber',
  'The Truman Show', 'Eternal Sunshine of the Spotless Mind',
  'Pulp Fiction', 'Kill Bill: Volume 1', 'Reservoir Dogs',
  'Parasite', 'Oldboy', 'The Godfather', 'Goodfellas',
  'Arrival', 'Dune', 'Blade Runner 2049',
  'Hereditary', 'Midsommar', 'Spirited Away', 'WALL-E',
  'The Grand Budapest Hotel', 'Moonrise Kingdom'
]);

const [persons] = await db.execute('SELECT id, name, slug, photoUrl FROM persons WHERE name IN (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
  'Christopher Nolan', 'Quentin Tarantino', 'Martin Scorsese', 'Francis Ford Coppola',
  'Jim Carrey', 'Denis Villeneuve', 'Bong Joon-ho', 'Wes Anderson',
  'Morgan Freeman', 'Tim Robbins', 'Brad Pitt', 'Leonardo DiCaprio',
  'Tom Hanks', 'Robert De Niro', 'Al Pacino', 'Meryl Streep'
]);

const movieMap = {};
for (const m of movies) movieMap[m.title] = m;

const personMap = {};
for (const p of persons) personMap[p.name] = p;

console.log('Movies found:', Object.keys(movieMap).length);
console.log('Persons found:', Object.keys(personMap).length);

// Room configurations with related content
const roomConfigs = [
  {
    slug: 'nolan-universe-deep-dive',
    relatedPerson: 'Christopher Nolan',
    relatedMovies: ['Inception', 'Interstellar', 'The Dark Knight'],
    relatedPersons: ['Christopher Nolan', 'Leonardo DiCaprio']
  },
  {
    slug: 'dumb-and-dumber-appreciation',
    relatedPerson: 'Jim Carrey',
    relatedMovies: ['Dumb and Dumber', 'The Truman Show', 'Eternal Sunshine of the Spotless Mind'],
    relatedPersons: ['Jim Carrey']
  },
  {
    slug: 'scorsese-vs-coppola-goat',
    relatedPerson: 'Martin Scorsese',
    relatedMovies: ['Goodfellas', 'The Godfather'],
    relatedPersons: ['Martin Scorsese', 'Francis Ford Coppola', 'Robert De Niro', 'Al Pacino']
  },
  {
    slug: '2024-oscar-season-recap',
    relatedMovies: ['Inception', 'Parasite', 'The Godfather'],
    relatedPersons: ['Christopher Nolan', 'Bong Joon-ho']
  },
  {
    slug: 'horror-marathon-night',
    relatedMovies: ['Hereditary', 'Midsommar'],
    relatedPersons: []
  },
  {
    slug: 'tarantino-retrospective',
    relatedPerson: 'Quentin Tarantino',
    relatedMovies: ['Pulp Fiction', 'Kill Bill: Volume 1', 'Reservoir Dogs'],
    relatedPersons: ['Quentin Tarantino', 'Brad Pitt']
  },
  {
    slug: 'animated-films-changed-cinema',
    relatedMovies: ['Spirited Away', 'WALL-E'],
    relatedPersons: []
  },
  {
    slug: 'villeneuve-scifi-masterclass',
    relatedPerson: 'Denis Villeneuve',
    relatedMovies: ['Arrival', 'Dune', 'Blade Runner 2049'],
    relatedPersons: ['Denis Villeneuve']
  },
  {
    slug: 'best-movie-endings-ever',
    relatedMovies: ['Inception', 'The Godfather', 'Pulp Fiction'],
    relatedPersons: ['Christopher Nolan', 'Francis Ford Coppola', 'Quentin Tarantino']
  },
  {
    slug: 'jim-carrey-evolution',
    relatedPerson: 'Jim Carrey',
    relatedMovies: ['The Truman Show', 'Eternal Sunshine of the Spotless Mind', 'Dumb and Dumber'],
    relatedPersons: ['Jim Carrey']
  },
  {
    slug: 'korean-cinema-wave',
    relatedMovies: ['Parasite', 'Oldboy'],
    relatedPersons: ['Bong Joon-ho']
  },
  {
    slug: 'wes-anderson-aesthetic',
    relatedPerson: 'Wes Anderson',
    relatedMovies: ['The Grand Budapest Hotel', 'Moonrise Kingdom'],
    relatedPersons: ['Wes Anderson']
  }
];

// Get room IDs
const [roomRows] = await db.execute('SELECT id, slug FROM audio_rooms');
const roomMap = {};
for (const r of roomRows) roomMap[r.slug] = r.id;

// Clear existing links
await db.execute('DELETE FROM room_related_links');

let linkOrder = 0;
let updated = 0;

for (const config of roomConfigs) {
  const roomId = roomMap[config.slug];
  if (!roomId) {
    console.log('Room not found:', config.slug);
    continue;
  }

  // Update room with primary related person/movie
  const relatedPersonId = config.relatedPerson ? personMap[config.relatedPerson]?.id || null : null;
  const relatedMovieId = config.relatedMovies?.[0] ? movieMap[config.relatedMovies[0]]?.id || null : null;

  await db.execute(
    'UPDATE audio_rooms SET relatedMovieId = ?, relatedPersonId = ? WHERE id = ?',
    [relatedMovieId, relatedPersonId, roomId]
  );
  updated++;

  // Insert related movie links
  let order = 1;
  for (const movieTitle of (config.relatedMovies || [])) {
    const movie = movieMap[movieTitle];
    if (!movie) {
      console.log('Movie not found:', movieTitle);
      continue;
    }
    await db.execute(
      'INSERT INTO room_related_links (roomId, movieId, personId, label, `order`) VALUES (?, ?, NULL, ?, ?)',
      [roomId, movie.id, movie.title, order++]
    );
  }

  // Insert related person links
  for (const personName of (config.relatedPersons || [])) {
    const person = personMap[personName];
    if (!person) {
      console.log('Person not found:', personName);
      continue;
    }
    await db.execute(
      'INSERT INTO room_related_links (roomId, movieId, personId, label, `order`) VALUES (?, NULL, ?, ?, ?)',
      [roomId, person.id, person.name, order++]
    );
  }

  console.log(`✓ ${config.slug}: ${order - 1} links`);
}

console.log(`\nUpdated ${updated} rooms with related content`);
const [[{ total }]] = await db.execute('SELECT COUNT(*) as total FROM room_related_links');
console.log(`Total room_related_links: ${total}`);

await db.end();
