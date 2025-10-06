# FLARE-Sat <img width="30" height="40" alt="logo" src="https://github.com/user-attachments/assets/c653e682-3c8d-4aa5-9794-53dd47ee668e" />


## Website: https://versatilevariable.github.io/NASA_FLARE-Sat/

<img width="300" height="300" alt="Flare Sat Detailed Logo header" src="https://github.com/user-attachments/assets/30ee1459-e2c9-44c3-abcc-f381a76372b9" /> <img width="400" height="216" alt="Colorway2-Color_Black2x width-580" src="https://github.com/user-attachments/assets/605eacd9-77f1-4d36-97e6-81d020b3b6f5" />



## About the Project

FLARESat is a web-based platform for satellite monitoring and data visualization. This project was developed for the NASA Space Apps Challenge 2025 for the catagory Commercializing Low Earth Orbit (LEO). The hackathon took place October 4th 2025 and lasted 48 hours. In this time we created a satellite constellation, CAD model, simulated expected data, custom lenses, and a working dashboard to compare our system against the exisiting NASA FIRMS satellites.

## Features

- Interactive 3D satellite visualization
- Real-time data monitoring utilizing API calls from NASA's FIRMS. (We baked in Data from past 24 hours for optimization and display purposes)
- Web-based interface
- Simulation of Delta Walker Constellation and their fire detection
- Dashboard portal for customers

## Dashboard
- 3x real speed video of our dashboard found at [https://versatilevariable.github.io/NASA_FLARE-Sat/dashboard.html](url)

![sped up 4x-output](https://github.com/user-attachments/assets/7ca1de30-0bf0-4cf2-9773-606ed8327f73)

## Project Structure

```
FLARESat/
├── docs/           # Documentation and web interface
│   ├── css/        # Styling files
│   ├── js/         # JavaScript files
│   └── images/     # Image assets
└── LICENSE         # License information
```

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Minimum of 2 gigs of avalible RAM, for best viewing use a modern browser with 8+ gigs of RAM.
   - We reccomend enabling hardware acceleration in your browser for optimal performance.
  
### Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/VersatileVariable/FLARESat.git
   ```
2. Navigate to the docs directory:
   ```bash
   cd FLARESat/docs
   ```
3. Open `index.html` in your web browser


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
However for the documentation of the hackathon in its current state, we expect a different branch moving foward if things were to be added.

## License

This project is licensed under the terms found in the LICENSE file. (MIT)


## Acknowledgments

- NASA Apps Challenge 2025
- Clemson CU Hackit
- NASA FIRMS and API
- Clemson University Makerspace
