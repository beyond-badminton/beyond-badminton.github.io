# Beyond Badminton - Tournament Manager

## Overview
This badminton tournament manager tool helps you easily organize badminton events by managing players and courts, and automatically generating schedules based on your parameters.

It was created to generate randomized matches while following specific fairness rules such as keeping teams balanced in skill. The app is suitable for badminton and other doubles-based games.

## Features
- **Player management**: maintain a permanent roster and select active participants for each event.
- **Court management**: define court names and configure their availability for specific time blocks.
- **Training schedule generation**: create balanced doubles or singles training sessions based on active players, availability windows, and court slots.
- **Tournament generation**: generate randomized qualification and playoff tournament flows with draw handling and results tracking.
- **Live scoring and stats**: review match scores, penalty scores, player stats, and partner/opponent insights.
- **Print and export**: print match sheets or export data for sharing or later use.
- **Privacy-focused storage**: all data is stored locally in the browser via `localStorage`.

## How it works
### 1. Players tab
Add players to the "All Players" list so they become part of your permanent saved roster. Then select the players who are active for the current event and set their arrival times and play durations.

### 2. Courts tab
Add your courts and define their blocked time windows. This lets the generator understand when each court is available and how many matches can run simultaneously.

### 3. Matches tab
Go to the "Matches" tab to generate training schedules and tournaments.

#### Training sub-tab
Generate a training schedule based on your active players and available courts. You can fine-tune it by adjusting the number of matches per hour, enabling singles, and more. The generated schedule includes match cards, player stats, penalty scoring, and drag-and-drop editing.

#### Tournament sub-tab
Generate a randomized, anonymous tournament schedule, automatically substituting placeholder numbers with player names. The workflow includes qualification draw setup, match progression, score tracking, and playoff management.

## Privacy & Data
- The app runs entirely locally on your device using JavaScript.
- All data is saved directly to the browser's local storage.
- No cookies or external server uploads are used.
- You can clear your saved data at any time using the built-in cleanup buttons or through your browser privacy settings.
- To access your application data on a different browser or device, use the Export and Import features.

## Feedback & Support
This tool is completely free to use. If you encounter any bugs, have a feature request, or want to view the source code, please visit the GitHub repository: https://github.com/beyond-badminton/beyond-badminton.github.io

Please note that this project was created as a hobby in a short amount of time, so there are still a few things that may need polishing.

Thank you for using the Tournament Manager!