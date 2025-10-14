# Petly Backend

A simple Node.js TypeScript backend for the Petly app.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check
- `GET /api/pets` - Get pets list

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run build:watch` - Build with watch mode

## Project Structure

```
src/
├── index.ts          # Main application entry point
└── ...               # Additional modules as you expand
```
