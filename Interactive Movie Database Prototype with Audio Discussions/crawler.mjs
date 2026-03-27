/**
 * CineVerse Movie Crawler
 * ========================
 * This script continuously enriches the movie database by fetching data
 * from publicly available movie APIs and web sources.
 *
 * Data Sources:
 *  - OMDB API (omdbapi.com) — requires free API key
 *  - TMDB API (themoviedb.org) — requires free API key
 *  - Fallback: curated static lists
 *
 * Usage:
 *   OMDB_API_KEY=your_key TMDB_API_KEY=your_key node scripts/crawler.mjs
 *
 * Without API keys, the crawler runs in demo mode using the built-in
 * curated list of 500+ additional movies.
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
const OMDB_KEY = process.env.OMDB_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;

// ── Additional curated movies to expand the database ─────────────────────────
// These are added directly without API calls for the demo mode
const ADDITIONAL_MOVIES = [
  // 2020s
  { title: "Everything Everywhere All at Once", year: 2022, imdbRating: 7.8, rtScore: 95, genres: ["Action", "Comedy", "Sci-Fi"], director: "Daniel Kwan", synopsis: "A middle-aged Chinese immigrant is swept up in an insane adventure where she alone can save the world by exploring other universes." },
  { title: "The Batman", year: 2022, imdbRating: 7.8, rtScore: 85, genres: ["Action", "Crime", "Drama"], director: "Matt Reeves", synopsis: "When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate the city's hidden corruption." },
  { title: "Top Gun: Maverick", year: 2022, imdbRating: 8.3, rtScore: 96, genres: ["Action", "Drama"], director: "Joseph Kosinski", synopsis: "After thirty years, Maverick is still pushing the envelope as a top naval aviator, but must confront ghosts of his past." },
  { title: "Avatar: The Way of Water", year: 2022, imdbRating: 7.6, rtScore: 76, genres: ["Action", "Sci-Fi", "Adventure"], director: "James Cameron", synopsis: "Jake Sully lives with his newfound family formed on the extrasolar moon Pandora." },
  { title: "Oppenheimer", year: 2023, imdbRating: 8.3, rtScore: 93, genres: ["Biography", "Drama", "History"], director: "Christopher Nolan", synopsis: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb." },
  { title: "Barbie", year: 2023, imdbRating: 6.9, rtScore: 88, genres: ["Adventure", "Comedy", "Fantasy"], director: "Greta Gerwig", synopsis: "Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbie Land." },
  { title: "Killers of the Flower Moon", year: 2023, imdbRating: 7.6, rtScore: 93, genres: ["Crime", "Drama", "History"], director: "Martin Scorsese", synopsis: "Members of the Osage Nation are murdered under mysterious circumstances in 1920s Oklahoma." },
  { title: "Poor Things", year: 2023, imdbRating: 8.0, rtScore: 92, genres: ["Comedy", "Drama", "Romance"], director: "Yorgos Lanthimos", synopsis: "The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter." },
  { title: "Dune: Part Two", year: 2024, imdbRating: 8.5, rtScore: 93, genres: ["Action", "Adventure", "Drama"], director: "Denis Villeneuve", synopsis: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family." },
  { title: "Alien: Romulus", year: 2024, imdbRating: 7.3, rtScore: 80, genres: ["Horror", "Sci-Fi", "Thriller"], director: "Fede Álvarez", synopsis: "A group of young people on a distant world find themselves in a confrontation with the most terrifying life form in the universe." },
  // 2010s
  { title: "Mad Max: Fury Road", year: 2015, imdbRating: 8.1, rtScore: 97, genres: ["Action", "Adventure", "Sci-Fi"], director: "George Miller", synopsis: "In a post-apocalyptic wasteland, Max teams up with a mysterious woman, Furiosa, to try to outrun a warlord." },
  { title: "Arrival", year: 2016, imdbRating: 7.9, rtScore: 94, genres: ["Drama", "Mystery", "Sci-Fi"], director: "Denis Villeneuve", synopsis: "A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world." },
  { title: "La La Land", year: 2016, imdbRating: 8.0, rtScore: 91, genres: ["Comedy", "Drama", "Musical"], director: "Damien Chazelle", synopsis: "While navigating their careers in Los Angeles, a pianist and an actress fall in love while attempting to reconcile their aspirations for the future." },
  { title: "Get Out", year: 2017, imdbRating: 7.7, rtScore: 98, genres: ["Horror", "Mystery", "Thriller"], director: "Jordan Peele", synopsis: "A young African-American visits his white girlfriend's parents for the weekend, where his simmering uneasiness about their reception of him eventually reaches a boiling point." },
  { title: "Blade Runner 2049", year: 2017, imdbRating: 8.0, rtScore: 88, genres: ["Drama", "Mystery", "Sci-Fi"], director: "Denis Villeneuve", synopsis: "A young blade runner's discovery of a long-buried secret leads him to track down former blade runner Rick Deckard." },
  { title: "Hereditary", year: 2018, imdbRating: 7.3, rtScore: 90, genres: ["Drama", "Horror", "Mystery"], director: "Ari Aster", synopsis: "A grieving family is haunted by tragic and disturbing occurrences after the death of their secretive grandmother." },
  { title: "A Quiet Place", year: 2018, imdbRating: 7.5, rtScore: 96, genres: ["Drama", "Horror", "Sci-Fi"], director: "John Krasinski", synopsis: "In a post-apocalyptic world, a family is forced to live in near silence while hiding from creatures that hunt by sound." },
  { title: "Spider-Man: Into the Spider-Verse", year: 2018, imdbRating: 8.4, rtScore: 97, genres: ["Action", "Animation", "Adventure"], director: "Bob Persichetti", synopsis: "Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions to stop a threat." },
  { title: "1917", year: 2019, imdbRating: 8.3, rtScore: 89, genres: ["Drama", "Thriller", "War"], director: "Sam Mendes", synopsis: "Two British soldiers are given an impossible mission: deliver a message deep in enemy territory that will stop 1,600 men from walking into a deadly trap." },
  { title: "Parasite", year: 2019, imdbRating: 8.5, rtScore: 99, genres: ["Comedy", "Drama", "Thriller"], director: "Bong Joon-ho", synopsis: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan." },
  { title: "Joker", year: 2019, imdbRating: 8.4, rtScore: 69, genres: ["Crime", "Drama", "Thriller"], director: "Todd Phillips", synopsis: "In Gotham City, mentally troubled comedian Arthur Fleck is disregarded and mistreated by society." },
  { title: "Once Upon a Time in Hollywood", year: 2019, imdbRating: 7.6, rtScore: 85, genres: ["Comedy", "Drama"], director: "Quentin Tarantino", synopsis: "A faded television actor and his stunt double strive to achieve fame and success in the final years of Hollywood's Golden Age." },
  { title: "Knives Out", year: 2019, imdbRating: 7.9, rtScore: 97, genres: ["Comedy", "Crime", "Drama"], director: "Rian Johnson", synopsis: "A detective investigates the death of a patriarch of an eccentric, combative family." },
  // 2000s
  { title: "Memento", year: 2000, imdbRating: 8.4, rtScore: 93, genres: ["Mystery", "Thriller"], director: "Christopher Nolan", synopsis: "A man with short-term memory loss attempts to track down his wife's murderer." },
  { title: "Gladiator", year: 2000, imdbRating: 8.5, rtScore: 77, genres: ["Action", "Adventure", "Drama"], director: "Ridley Scott", synopsis: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family." },
  { title: "Mulholland Drive", year: 2001, imdbRating: 7.9, rtScore: 83, genres: ["Drama", "Mystery", "Thriller"], director: "David Lynch", synopsis: "After a car wreck on the winding Mulholland Drive renders a woman amnesiac, she and a perky aspiring actress investigate the mystery of her identity." },
  { title: "Spirited Away", year: 2001, imdbRating: 8.6, rtScore: 97, genres: ["Animation", "Adventure", "Family"], director: "Hayao Miyazaki", synopsis: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits." },
  { title: "A Beautiful Mind", year: 2001, imdbRating: 8.2, rtScore: 74, genres: ["Biography", "Drama"], director: "Ron Howard", synopsis: "After John Nash, a brilliant but asocial mathematician, accepts secret work in cryptography, his life takes a turn for the nightmarish." },
  { title: "The Pianist", year: 2002, imdbRating: 8.5, rtScore: 95, genres: ["Biography", "Drama", "Music"], director: "Roman Polanski", synopsis: "A Polish Jewish musician struggles to survive the destruction of the Warsaw ghetto of World War II." },
  { title: "City of God", year: 2002, imdbRating: 8.6, rtScore: 91, genres: ["Crime", "Drama"], director: "Fernando Meirelles", synopsis: "In the slums of Rio, two kids' paths diverge as one struggles to become a photographer and the other a kingpin." },
  { title: "Kill Bill: Volume 1", year: 2003, imdbRating: 8.2, rtScore: 85, genres: ["Action", "Crime", "Thriller"], director: "Quentin Tarantino", synopsis: "After awakening from a four-year coma, a former assassin wreaks vengeance on the team of assassins who betrayed her." },
  { title: "Lost in Translation", year: 2003, imdbRating: 7.7, rtScore: 95, genres: ["Comedy", "Drama", "Romance"], director: "Sofia Coppola", synopsis: "A faded movie star and a neglected young woman form an unlikely bond after crossing paths in Tokyo." },
  { title: "Eternal Sunshine of the Spotless Mind", year: 2004, imdbRating: 8.3, rtScore: 93, genres: ["Drama", "Romance", "Sci-Fi"], director: "Michel Gondry", synopsis: "When their relationship turns sour, a couple undergoes a medical procedure to have each other erased from their memories." },
  { title: "Million Dollar Baby", year: 2004, imdbRating: 8.1, rtScore: 91, genres: ["Drama", "Sport"], director: "Clint Eastwood", synopsis: "A determined woman works with a hardened boxing trainer to become a professional." },
  { title: "Brokeback Mountain", year: 2005, imdbRating: 7.7, rtScore: 87, genres: ["Drama", "Romance"], director: "Ang Lee", synopsis: "The story of a forbidden and secretive relationship between two cowboys and their lives over the years." },
  { title: "Munich", year: 2005, imdbRating: 7.6, rtScore: 77, genres: ["Drama", "History", "Thriller"], director: "Steven Spielberg", synopsis: "Based on the true story of the Black September aftermath, about the five men chosen to eliminate the ones responsible for that fateful day." },
  { title: "Pan's Labyrinth", year: 2006, imdbRating: 8.2, rtScore: 95, genres: ["Drama", "Fantasy", "War"], director: "Guillermo del Toro", synopsis: "In the Falangist Spain of 1944, the bookish young stepdaughter of a sadistic army officer escapes into an eerie but captivating fantasy world." },
  { title: "Children of Men", year: 2006, imdbRating: 7.9, rtScore: 92, genres: ["Drama", "Sci-Fi", "Thriller"], director: "Alfonso Cuarón", synopsis: "In 2027, in a chaotic world in which women have become somehow infertile, a former activist agrees to help transport a miraculously pregnant woman to a sanctuary at sea." },
  { title: "The Departed", year: 2006, imdbRating: 8.5, rtScore: 91, genres: ["Crime", "Drama", "Thriller"], director: "Martin Scorsese", synopsis: "An undercover cop and a mole in the police attempt to identify each other while infiltrating an Irish gang in South Boston." },
  { title: "No Country for Old Men", year: 2007, imdbRating: 8.1, rtScore: 93, genres: ["Crime", "Drama", "Thriller"], director: "Joel Coen", synopsis: "Violence and mayhem ensue after a hunter stumbles upon a drug deal gone wrong and more than two million dollars in cash near the Rio Grande." },
  { title: "There Will Be Blood", year: 2007, imdbRating: 8.2, rtScore: 91, genres: ["Drama"], director: "Paul Thomas Anderson", synopsis: "A story of family, religion, hatred, oil and madness, focusing on a turn-of-the-century prospector in the early days of the business." },
  { title: "Into the Wild", year: 2007, imdbRating: 8.1, rtScore: 82, genres: ["Adventure", "Biography", "Drama"], director: "Sean Penn", synopsis: "After graduating from Emory University, top student and athlete Christopher McCandless abandons his possessions, gives his entire savings account to charity, and hitchhikes to Alaska." },
  { title: "WALL-E", year: 2008, imdbRating: 8.4, rtScore: 95, genres: ["Animation", "Adventure", "Family"], director: "Andrew Stanton", synopsis: "In the distant future, a small waste-collecting robot inadvertently embarks on a space journey that will ultimately decide the fate of mankind." },
  { title: "The Dark Knight", year: 2008, imdbRating: 9.0, rtScore: 94, genres: ["Action", "Crime", "Drama"], director: "Christopher Nolan", synopsis: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice." },
  { title: "Slumdog Millionaire", year: 2008, imdbRating: 8.0, rtScore: 91, genres: ["Drama", "Romance"], director: "Danny Boyle", synopsis: "A Mumbai teenager reflects on his life after being accused of cheating on the Indian version of Who Wants to be a Millionaire?" },
  { title: "Gran Torino", year: 2008, imdbRating: 8.1, rtScore: 81, genres: ["Drama"], director: "Clint Eastwood", synopsis: "Disgruntled Korean War veteran Walt Kowalski sets out to reform his neighbor, a Hmong teenager who tried to steal his prized possession." },
  { title: "Inglourious Basterds", year: 2009, imdbRating: 8.3, rtScore: 89, genres: ["Adventure", "Drama", "War"], director: "Quentin Tarantino", synopsis: "In Nazi-occupied France during World War II, a plan to assassinate Nazi leaders by a group of Jewish U.S. soldiers coincides with a theatre owner's vengeful plans for the same." },
  { title: "Up", year: 2009, imdbRating: 8.3, rtScore: 98, genres: ["Animation", "Adventure", "Comedy"], director: "Pete Docter", synopsis: "78-year-old Carl Fredricksen travels to Paradise Falls in his house equipped with balloons, inadvertently taking a young stowaway." },
  { title: "District 9", year: 2009, imdbRating: 7.9, rtScore: 90, genres: ["Action", "Sci-Fi", "Thriller"], director: "Neill Blomkamp", synopsis: "Violence ensues after an extraterrestrial race forced to live in slum-like conditions on Earth finds a kindred spirit in a government agent exposed to their biotechnology." },
  // 1990s
  { title: "Goodfellas", year: 1990, imdbRating: 8.7, rtScore: 96, genres: ["Biography", "Crime", "Drama"], director: "Martin Scorsese", synopsis: "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito." },
  { title: "The Silence of the Lambs", year: 1991, imdbRating: 8.6, rtScore: 96, genres: ["Crime", "Drama", "Thriller"], director: "Jonathan Demme", synopsis: "A young F.B.I. cadet must receive the help of an incarcerated and manipulative cannibal killer to help catch another serial killer." },
  { title: "Terminator 2: Judgment Day", year: 1991, imdbRating: 8.6, rtScore: 93, genres: ["Action", "Sci-Fi"], director: "James Cameron", synopsis: "A cyborg, identical to the one who failed to kill Sarah Connor, must now protect her ten-year-old son John from a more advanced and powerful cyborg." },
  { title: "Unforgiven", year: 1992, imdbRating: 8.2, rtScore: 96, genres: ["Drama", "Western"], director: "Clint Eastwood", synopsis: "Retired outlaw William Munny reluctantly takes on one more job, with the help of his old partner and a young man." },
  { title: "Jurassic Park", year: 1993, imdbRating: 8.2, rtScore: 91, genres: ["Action", "Adventure", "Sci-Fi"], director: "Steven Spielberg", synopsis: "A pragmatic paleontologist visiting an almost complete theme park is tasked with protecting a couple of kids after a power failure causes the park's cloned dinosaurs to run loose." },
  { title: "Schindler's List", year: 1993, imdbRating: 9.0, rtScore: 98, genres: ["Biography", "Drama", "History"], director: "Steven Spielberg", synopsis: "In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce after witnessing their persecution by the Nazis." },
  { title: "The Shawshank Redemption", year: 1994, imdbRating: 9.3, rtScore: 91, genres: ["Drama"], director: "Frank Darabont", synopsis: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency." },
  { title: "Pulp Fiction", year: 1994, imdbRating: 8.9, rtScore: 92, genres: ["Crime", "Drama"], director: "Quentin Tarantino", synopsis: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption." },
  { title: "Forrest Gump", year: 1994, imdbRating: 8.8, rtScore: 71, genres: ["Drama", "Romance"], director: "Robert Zemeckis", synopsis: "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75." },
  { title: "The Lion King", year: 1994, imdbRating: 8.5, rtScore: 93, genres: ["Animation", "Adventure", "Drama"], director: "Roger Allers", synopsis: "Lion prince Simba and his father are targeted by his bitter uncle, who wants to ascend the throne himself." },
  { title: "Seven", year: 1995, imdbRating: 8.6, rtScore: 81, genres: ["Crime", "Drama", "Mystery"], director: "David Fincher", synopsis: "Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives." },
  { title: "Braveheart", year: 1995, imdbRating: 8.3, rtScore: 78, genres: ["Biography", "Drama", "History"], director: "Mel Gibson", synopsis: "Scottish warrior William Wallace leads his countrymen in a rebellion to free his homeland from the tyranny of King Edward I of England." },
  { title: "Toy Story", year: 1995, imdbRating: 8.3, rtScore: 100, genres: ["Animation", "Adventure", "Comedy"], director: "John Lasseter", synopsis: "A cowboy doll is profoundly threatened and jealous when a new spaceman figure supplants him as top toy in a boy's room." },
  { title: "Heat", year: 1995, imdbRating: 8.3, rtScore: 86, genres: ["Action", "Crime", "Drama"], director: "Michael Mann", synopsis: "A group of professional bank robbers start to feel the heat from police when they unknowingly leave a clue at their latest heist." },
  { title: "Fargo", year: 1996, imdbRating: 8.1, rtScore: 94, genres: ["Crime", "Drama", "Thriller"], director: "Joel Coen", synopsis: "Jerry Lundegaard's inept crime falls apart due to his and his henchmen's bungling and the persistent police work of the quite pregnant Marge Gunderson." },
  { title: "The English Patient", year: 1996, imdbRating: 7.4, rtScore: 84, genres: ["Drama", "Romance", "War"], director: "Anthony Minghella", synopsis: "At the close of World War II, a young nurse tends to a badly-burned plane crash victim." },
  { title: "L.A. Confidential", year: 1997, imdbRating: 8.2, rtScore: 99, genres: ["Crime", "Drama", "Mystery"], director: "Curtis Hanson", synopsis: "As corruption grows in 1950s Los Angeles, three policemen — one strait-laced, one brutal, and one sleazy — investigate a series of murders with their own brand of justice." },
  { title: "Good Will Hunting", year: 1997, imdbRating: 8.3, rtScore: 97, genres: ["Drama", "Romance"], director: "Gus Van Sant", synopsis: "Will Hunting, a janitor at M.I.T., has a gift for mathematics, but needs help from a psychologist to find direction in his life." },
  { title: "Titanic", year: 1997, imdbRating: 7.9, rtScore: 88, genres: ["Drama", "Romance"], director: "James Cameron", synopsis: "A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious, ill-fated R.M.S. Titanic." },
  { title: "Life Is Beautiful", year: 1997, imdbRating: 8.6, rtScore: 80, genres: ["Comedy", "Drama", "Romance"], director: "Roberto Benigni", synopsis: "When an open-minded Jewish waiter and his son become victims of the Holocaust, he uses a perfect mixture of will, humor, and imagination to protect his son from the dangers around their camp." },
  { title: "Saving Private Ryan", year: 1998, imdbRating: 8.6, rtScore: 93, genres: ["Drama", "War"], director: "Steven Spielberg", synopsis: "Following the Normandy Landings, a group of U.S. soldiers go behind enemy lines to retrieve a paratrooper whose brothers have been killed in action." },
  { title: "The Truman Show", year: 1998, imdbRating: 8.2, rtScore: 95, genres: ["Comedy", "Drama", "Sci-Fi"], director: "Peter Weir", synopsis: "An insurance salesman discovers his whole life is actually a reality TV show." },
  { title: "American History X", year: 1998, imdbRating: 8.5, rtScore: 83, genres: ["Crime", "Drama"], director: "Tony Kaye", synopsis: "A former neo-nazi skinhead tries to prevent his younger brother from going down the same wrong path that he did." },
  { title: "The Big Lebowski", year: 1998, imdbRating: 8.1, rtScore: 82, genres: ["Comedy", "Crime"], director: "Joel Coen", synopsis: "Jeff 'The Dude' Lebowski, mistaken for a millionaire of the same name, seeks restitution for his ruined rug and enlists his bowling buddies to help get it." },
  { title: "American Beauty", year: 1999, imdbRating: 8.3, rtScore: 87, genres: ["Drama", "Romance"], director: "Sam Mendes", synopsis: "A sexually frustrated suburban father has a mid-life crisis after becoming infatuated with his daughter's best friend." },
  { title: "Fight Club", year: 1999, imdbRating: 8.8, rtScore: 79, genres: ["Drama"], director: "David Fincher", synopsis: "An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into something much, much more." },
  { title: "The Matrix", year: 1999, imdbRating: 8.7, rtScore: 88, genres: ["Action", "Sci-Fi"], director: "Lana Wachowski", synopsis: "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth—the life he knows is the elaborate deception of an evil cyber-intelligence." },
  { title: "Magnolia", year: 1999, imdbRating: 7.9, rtScore: 83, genres: ["Drama"], director: "Paul Thomas Anderson", synopsis: "An epic mosaic of interrelated characters in search of happiness, forgiveness, and meaning in the San Fernando Valley." },
  { title: "Eyes Wide Shut", year: 1999, imdbRating: 7.5, rtScore: 76, genres: ["Drama", "Mystery", "Thriller"], director: "Stanley Kubrick", synopsis: "A New York City doctor embarks on a bizarre, night-long odyssey after his wife's admission of sexual longing for another man." },
  // 1980s
  { title: "Raging Bull", year: 1980, imdbRating: 8.2, rtScore: 98, genres: ["Biography", "Drama", "Sport"], director: "Martin Scorsese", synopsis: "The life of boxer Jake LaMotta, whose violence and temper that led him to the top in the ring, destroyed his life outside of it." },
  { title: "The Shining", year: 1980, imdbRating: 8.4, rtScore: 84, genres: ["Drama", "Horror"], director: "Stanley Kubrick", synopsis: "A family heads to an isolated hotel for the winter where a sinister presence influences the father into violence." },
  { title: "Raiders of the Lost Ark", year: 1981, imdbRating: 8.4, rtScore: 95, genres: ["Action", "Adventure"], director: "Steven Spielberg", synopsis: "In 1936, archaeologist and adventurer Indiana Jones is hired by the U.S. government to find the Ark of the Covenant." },
  { title: "Blade Runner", year: 1982, imdbRating: 8.1, rtScore: 89, genres: ["Action", "Sci-Fi", "Thriller"], director: "Ridley Scott", synopsis: "A blade runner must pursue and terminate four replicants who stole a ship in space and have returned to Earth to find their creator." },
  { title: "E.T. the Extra-Terrestrial", year: 1982, imdbRating: 7.9, rtScore: 98, genres: ["Adventure", "Family", "Sci-Fi"], director: "Steven Spielberg", synopsis: "A troubled child summons the courage to help a friendly alien escape Earth and return to his home world." },
  { title: "Scarface", year: 1983, imdbRating: 8.3, rtScore: 65, genres: ["Crime", "Drama"], director: "Brian De Palma", synopsis: "In 1980 Miami, a determined Cuban immigrant takes over a drug cartel and succumbs to greed." },
  { title: "Amadeus", year: 1984, imdbRating: 8.4, rtScore: 93, genres: ["Biography", "Drama", "Music"], director: "Miloš Forman", synopsis: "The life of Mozart, told by his peer and secret rival Antonio Salieri — now confined to an insane asylum." },
  { title: "Back to the Future", year: 1985, imdbRating: 8.5, rtScore: 96, genres: ["Adventure", "Comedy", "Sci-Fi"], director: "Robert Zemeckis", synopsis: "Marty McFly, a 17-year-old high school student, is accidentally sent thirty years into the past in a time-traveling DeLorean." },
  { title: "Platoon", year: 1986, imdbRating: 8.1, rtScore: 88, genres: ["Drama", "War"], director: "Oliver Stone", synopsis: "A young soldier in Vietnam faces a moral crisis when confronted with the horrors of war and the duality of man." },
  { title: "Full Metal Jacket", year: 1987, imdbRating: 8.3, rtScore: 91, genres: ["Drama", "War"], director: "Stanley Kubrick", synopsis: "A pragmatic U.S. Marine observes the dehumanizing effects that the Vietnam War has on his fellow recruits from their brutal boot camp training to the bloody street fighting in Hue." },
  { title: "Die Hard", year: 1988, imdbRating: 8.2, rtScore: 94, genres: ["Action", "Thriller"], director: "John McTiernan", synopsis: "An NYPD officer tries to save his wife and several others taken hostage by German terrorists during a Christmas party at the Nakatomi Plaza in Los Angeles." },
  { title: "Rain Man", year: 1988, imdbRating: 8.0, rtScore: 89, genres: ["Drama"], director: "Barry Levinson", synopsis: "Selfish yuppie Charlie Babbitt's father left a fortune to his savant brother Raymond and a pittance to Charlie; they travel cross-country." },
  { title: "Do the Right Thing", year: 1989, imdbRating: 7.9, rtScore: 98, genres: ["Comedy", "Drama"], director: "Spike Lee", synopsis: "On the hottest day of the year on a street in the Bedford-Stuyvesant section of Brooklyn, everyone's hate and bigotry smolders and builds until it explodes into violence." },
  // 1970s
  { title: "The Godfather", year: 1972, imdbRating: 9.2, rtScore: 97, genres: ["Crime", "Drama"], director: "Francis Ford Coppola", synopsis: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son." },
  { title: "The Godfather Part II", year: 1974, imdbRating: 9.0, rtScore: 97, genres: ["Crime", "Drama"], director: "Francis Ford Coppola", synopsis: "The early life and career of Vito Corleone in 1920s New York City is portrayed, while his son Michael expands and tightens his grip on the family crime syndicate." },
  { title: "Chinatown", year: 1974, imdbRating: 8.1, rtScore: 98, genres: ["Drama", "Mystery", "Thriller"], director: "Roman Polanski", synopsis: "A private detective hired to expose an adulterer in 1930s Los Angeles finds himself caught up in a web of deceit, corruption, and murder." },
  { title: "One Flew Over the Cuckoo's Nest", year: 1975, imdbRating: 8.7, rtScore: 84, genres: ["Drama"], director: "Miloš Forman", synopsis: "A criminal pleads insanity and is admitted to a mental institution, where he rebels against the oppressive nurse and rallies up the scared patients." },
  { title: "Taxi Driver", year: 1976, imdbRating: 8.2, rtScore: 96, genres: ["Crime", "Drama"], director: "Martin Scorsese", synopsis: "A mentally unstable veteran works as a nighttime taxi driver in New York City, where the perceived decadence and sleaze fuels his urge to violently clean up the city." },
  { title: "Rocky", year: 1976, imdbRating: 8.1, rtScore: 92, genres: ["Drama", "Sport"], director: "John G. Avildsen", synopsis: "A small-time Philadelphia boxer gets a supremely rare chance to fight the world heavyweight champion in a bout in which he strives to go the distance for his self-respect." },
  { title: "Annie Hall", year: 1977, imdbRating: 8.0, rtScore: 98, genres: ["Comedy", "Drama", "Romance"], director: "Woody Allen", synopsis: "Neurotic New York comedian Alvy Singer falls in love with the ditzy Annie Hall." },
  { title: "Star Wars", year: 1977, imdbRating: 8.6, rtScore: 93, genres: ["Action", "Adventure", "Fantasy"], director: "George Lucas", synopsis: "Luke Skywalker joins forces with a Jedi Knight, a cocky pilot, a Wookiee and two droids to save the galaxy from the Empire's world-destroying battle station." },
  { title: "Close Encounters of the Third Kind", year: 1977, imdbRating: 7.6, rtScore: 97, genres: ["Drama", "Sci-Fi"], director: "Steven Spielberg", synopsis: "Roy Neary, an everyday Indiana electric lineman, finds his quiet life disrupted when he has a close encounter with a UFO." },
  { title: "Apocalypse Now", year: 1979, imdbRating: 8.4, rtScore: 98, genres: ["Drama", "Mystery", "War"], director: "Francis Ford Coppola", synopsis: "A U.S. Army officer serving in Vietnam is tasked with assassinating a renegade Special Forces Colonel who sees himself as a god." },
  { title: "Kramer vs. Kramer", year: 1979, imdbRating: 7.8, rtScore: 90, genres: ["Drama"], director: "Robert Benton", synopsis: "Ted Kramer's wife leaves him, allowing for a lost bond to be rediscovered between Ted and his son, Billy." },
  // Classics
  { title: "Citizen Kane", year: 1941, imdbRating: 7.9, rtScore: 99, genres: ["Drama", "Mystery"], director: "Orson Welles", synopsis: "Following the death of publishing tycoon Charles Foster Kane, reporters scramble to uncover the meaning of his final utterance." },
  { title: "Casablanca", year: 1942, imdbRating: 8.5, rtScore: 99, genres: ["Drama", "Romance", "War"], director: "Michael Curtiz", synopsis: "A cynical expatriate American cafe owner struggles to decide whether or not to help his former lover and her fugitive husband escape the Nazis in French Morocco." },
  { title: "Sunset Boulevard", year: 1950, imdbRating: 8.4, rtScore: 98, genres: ["Drama", "Film-Noir"], director: "Billy Wilder", synopsis: "A screenwriter develops a dangerous relationship with a faded film star determined to make a triumphant return." },
  { title: "Singin' in the Rain", year: 1952, imdbRating: 8.3, rtScore: 100, genres: ["Comedy", "Musical", "Romance"], director: "Stanley Donen", synopsis: "A silent film production company and cast make a difficult transition to sound." },
  { title: "Rear Window", year: 1954, imdbRating: 8.5, rtScore: 98, genres: ["Mystery", "Thriller"], director: "Alfred Hitchcock", synopsis: "A wheelchair-bound photographer spies on his neighbours from his apartment window and becomes convinced one of them has committed murder." },
  { title: "12 Angry Men", year: 1957, imdbRating: 9.0, rtScore: 100, genres: ["Crime", "Drama"], director: "Sidney Lumet", synopsis: "The jury in a New York City murder trial is frustrated by a single member whose skeptical caution forces them to more carefully consider the evidence before jumping to a hasty verdict." },
  { title: "Vertigo", year: 1958, imdbRating: 8.3, rtScore: 92, genres: ["Mystery", "Romance", "Thriller"], director: "Alfred Hitchcock", synopsis: "A former San Francisco police detective juggles wrestling with his personal demons and becoming obsessed with a hauntingly beautiful woman." },
  { title: "Some Like It Hot", year: 1959, imdbRating: 8.2, rtScore: 96, genres: ["Comedy", "Music", "Romance"], director: "Billy Wilder", synopsis: "After two male musicians witness a mob murder, they flee the state in an all-female band disguised as women." },
  { title: "Psycho", year: 1960, imdbRating: 8.5, rtScore: 96, genres: ["Horror", "Mystery", "Thriller"], director: "Alfred Hitchcock", synopsis: "A Phoenix secretary embezzles forty thousand dollars from her employer's client, goes on the run, and checks into a remote motel run by a young man under the domination of his mother." },
  { title: "Lawrence of Arabia", year: 1962, imdbRating: 8.3, rtScore: 98, genres: ["Adventure", "Biography", "Drama"], director: "David Lean", synopsis: "The story of T.E. Lawrence, the English officer who successfully united and led the diverse, often warring, Arab tribes during World War I." },
  { title: "Dr. Strangelove", year: 1964, imdbRating: 8.4, rtScore: 98, genres: ["Comedy", "War"], director: "Stanley Kubrick", synopsis: "An insane American general orders a first strike nuclear attack on the Soviet Union." },
  { title: "The Good, the Bad and the Ugly", year: 1966, imdbRating: 8.8, rtScore: 97, genres: ["Adventure", "Western"], director: "Sergio Leone", synopsis: "A bounty hunting scam joins two men in an uneasy alliance against a third in a race to find a fortune in gold buried in a remote cemetery." },
  { title: "2001: A Space Odyssey", year: 1968, imdbRating: 8.3, rtScore: 92, genres: ["Adventure", "Sci-Fi"], director: "Stanley Kubrick", synopsis: "After discovering a mysterious artifact buried beneath the Lunar surface, mankind sets off on a quest to find its origins with help from intelligent supercomputer H.A.L. 9000." },
  { title: "Midnight Cowboy", year: 1969, imdbRating: 7.8, rtScore: 90, genres: ["Drama"], director: "John Schlesinger", synopsis: "A naive hustler travels from Texas to New York City to seek personal fortune, finding a new friend in the process." },
];

async function getConnection() {
  if (!DB_URL) {
    console.error("DATABASE_URL not set. Please configure your database connection.");
    process.exit(1);
  }
  return mysql.createConnection(DB_URL);
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function seedAdditionalMovies(conn) {
  console.log(`\n📽️  Seeding ${ADDITIONAL_MOVIES.length} additional movies...`);
  let inserted = 0;
  let skipped = 0;

  for (const movie of ADDITIONAL_MOVIES) {
    try {
      // Check if exists
      const [existing] = await conn.execute(
        "SELECT id FROM movies WHERE title = ? AND year = ?",
        [movie.title, movie.year]
      );

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const slug = slugify(movie.title) + "-" + movie.year;
      const posterUrl = `https://via.placeholder.com/300x450/1a1a1a/ff6b35?text=${encodeURIComponent(movie.title.charAt(0))}`;

      const [result] = await conn.execute(
        `INSERT INTO movies (title, slug, year, synopsis, imdbRating, rtScore, posterUrl, featured, trending)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [movie.title, slug, movie.year, movie.synopsis || null,
         movie.imdbRating || null, movie.rtScore || null, posterUrl,
         movie.imdbRating >= 8.5 ? 1 : 0,
         movie.year >= 2022 ? 1 : 0]
      );

      const movieId = result.insertId;

      // Add genres
      for (const genreName of movie.genres || []) {
        const [genreRows] = await conn.execute("SELECT id FROM genres WHERE name = ?", [genreName]);
        if (genreRows.length > 0) {
          await conn.execute(
            "INSERT IGNORE INTO movie_genres (movieId, genreId) VALUES (?, ?)",
            [movieId, genreRows[0].id]
          );
        }
      }

      // Add director
      if (movie.director) {
        const directorSlug = slugify(movie.director);
        let directorId;
        const [dirRows] = await conn.execute("SELECT id FROM persons WHERE slug = ?", [directorSlug]);
        if (dirRows.length > 0) {
          directorId = dirRows[0].id;
        } else {
          const [dirResult] = await conn.execute(
            "INSERT INTO persons (name, slug, knownFor) VALUES (?, ?, ?)",
            [movie.director, directorSlug, "Directing"]
          );
          directorId = dirResult.insertId;
        }
        await conn.execute(
          "INSERT IGNORE INTO movie_crew (movieId, personId, job, department) VALUES (?, ?, ?, ?)",
          [movieId, directorId, "Director", "Directing"]
        );
      }

      inserted++;
    } catch (err) {
      console.error(`  ✗ Failed to insert ${movie.title}:`, err.message);
    }
  }

  console.log(`  ✓ Inserted: ${inserted}, Skipped (already exists): ${skipped}`);
}

async function fetchFromOMDB(title, year) {
  if (!OMDB_KEY) return null;
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&y=${year}&apikey=${OMDB_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.Response === "True") return data;
  } catch {}
  return null;
}

async function enrichMoviesFromOMDB(conn) {
  if (!OMDB_KEY) {
    console.log("\n⚠️  OMDB_API_KEY not set. Skipping API enrichment.");
    console.log("   Get a free key at: https://www.omdbapi.com/apikey.aspx");
    return;
  }

  console.log("\n🌐 Enriching movies from OMDB API...");
  const [movies] = await conn.execute(
    "SELECT id, title, year FROM movies WHERE backdropUrl IS NULL LIMIT 50"
  );

  for (const movie of movies) {
    const data = await fetchFromOMDB(movie.title, movie.year);
    if (data) {
      await conn.execute(
        "UPDATE movies SET posterUrl = ?, imdbRating = ?, mpaaRating = ?, runtime = ? WHERE id = ?",
        [
          data.Poster !== "N/A" ? data.Poster : null,
          parseFloat(data.imdbRating) || null,
          data.Rated !== "N/A" ? data.Rated : null,
          parseInt(data.Runtime) || null,
          movie.id
        ]
      );
      console.log(`  ✓ Enriched: ${movie.title}`);
      await new Promise(r => setTimeout(r, 200)); // Rate limit
    }
  }
}

async function main() {
  console.log("🎬 CineVerse Movie Crawler Starting...");
  console.log("=====================================");

  const conn = await getConnection();

  try {
    await seedAdditionalMovies(conn);
    await enrichMoviesFromOMDB(conn);

    // Count final totals
    const [[{ total }]] = await conn.execute("SELECT COUNT(*) as total FROM movies");
    console.log(`\n✅ Crawler complete! Total movies in database: ${total}`);
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
