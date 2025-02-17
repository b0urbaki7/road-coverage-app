# Road Coverage Calculator

An interactive tool to calculate and visualize road coverage percentages for any city using Mapbox and OpenStreetMap data.

## Features
- City search functionality using Mapbox Geocoding
- Interactive map navigation
- Road coverage calculation for any viewport
- Area-based analysis

## Setup

1. Clone the repository:
```bash
git clone https://github.com/b0urbaki7/road-coverage-calculator.git
cd road-coverage-calculator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Mapbox token:
```
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
```

4. Start the development server:
```bash
npm start
```

## Environment Variables

The following environment variables are required:

- `REACT_APP_MAPBOX_TOKEN`: Your Mapbox API token

Copy `.env.example` to `.env` and fill in your values.

## Technologies Used
- React
- Vite
- Mapbox GL JS
- OpenStreetMap (Overpass API)
- Tailwind CSS

## License
MIT
