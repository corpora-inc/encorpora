# Soccer Books Realignment — State

## Running NOW (parallel):
- Goalkeeper (02-goalie): 23 langs × 633 segs — log: /tmp/realign_goalie.log
- Sweeper (03-sweeper): 23 langs × 613 segs — log: /tmp/realign_sweeper.log

## Queued:
- Defender (04-defender): 23 langs × 557 segs
- Striker (05-striker): 13 langs × 611 segs

## To start Defender + Striker after Goalie/Sweeper finish:
```bash
bash /tmp/realign_soccer.sh "Defender" "/home/skyl/encorpora/books/sports/u10-7v7-soccer/04-defender/pack" > /tmp/realign_defender.log 2>&1 &
bash /tmp/realign_soccer.sh "Striker" "/home/skyl/encorpora/books/sports/u10-7v7-soccer/05-striker/pack" > /tmp/realign_striker.log 2>&1 &
```

## Check progress:
```bash
grep -c "] DONE" /tmp/realign_goalie.log /tmp/realign_sweeper.log
grep "FAILED" /tmp/realign_goalie.log /tmp/realign_sweeper.log
```

## All books publish at v0.2.0, voice-id ian-narration, tier public
## NO --force used anywhere
