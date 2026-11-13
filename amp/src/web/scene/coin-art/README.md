# Coin faces

The obverse (heads) of each United States coin, drawn wherever the app shows a
coin. Each file is a photograph of the coin published by the United States
Mint, cropped to the coin's circle, resized to 448 px and saved as WebP. The
inscriptions on these obverses never state the coin's value.

`scripts/build-coin-art.ts` embeds these files in `../coin-art.ts` as data
URLs, so a coin never waits on the network. Run it after changing a file;
`tests/coin-art.test.ts` fails if the two differ.

| File | Design | Source | Public-domain basis |
| --- | --- | --- | --- |
| `penny.webp` | Lincoln cent obverse, Victor David Brenner (1909), 2010 strike | United States Mint photo, via https://commons.wikimedia.org/wiki/File:2010_cent_obverse.png | Coin design and photo are works of the United States Government (Treasury, United States Mint); tagged PD-USGov-money |
| `nickel.webp` | Jefferson nickel obverse, Felix Schlag (1938 to 2004 design), 2004 strike | United States Mint Historical Image Library, via https://commons.wikimedia.org/wiki/File:Jefferson-Nickel-Unc-Obv.jpg | United States Mint image of a circulating coin design in the public domain; tagged PD US money |
| `dime.webp` | Roosevelt dime obverse, John R. Sinnock (1946), 2013 strike | United States Mint photo, via https://commons.wikimedia.org/wiki/File:Dime_Obverse_13.png | Work of the United States Mint; tagged PD-USGov-Treasury |
| `quarter.webp` | Washington quarter obverse, John Flanagan (1932 design, classic inscriptions restored in 2021), 2021 strike | United States Mint, via https://commons.wikimedia.org/wiki/File:2021-P_US_Quarter_Obverse.jpg (published at https://www.usmint.gov/coins/coin-medal-programs/circulating-coins/general-george-washington-crossing-the-delaware-quarter) | Work of the United States Mint; tagged PD-USGov-Treasury |
