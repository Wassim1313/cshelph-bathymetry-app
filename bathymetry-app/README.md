# C-SHELPh Bathymetry Extraction — Web Application

Web application that runs the **real C-SHELPh algorithm** (`cshelph` v2.9 PyPI package) on **real ICESat-2 ATL03 data** downloaded via `earthaccess`. No demo data, no simulation — everything is the actual pipeline from the [C-SHELPh notebook](https://github.com/nmt28/C-SHELPh/blob/main/run_bathymetry_extraction.ipynb).

## What It Does

1. User draws an ROI on the map (coastal area with clear shallow water)
2. Backend authenticates with NASA EarthData via `earthaccess`
3. Searches + downloads real ATL03 H5 granules for that ROI
4. Runs the full cshelph pipeline:
   - `cshelph.read_atl03()` — reads photon-level data from H5
   - `cshelph.convert_wgs_to_utm()` + `cshelph.orthometric_correction()` — EGM2008
   - `cshelph.ref_linear_interp()` — interpolates reference elevation per photon
   - `cshelph.bin_data()` — bins photons for density-based classification
   - `cshelph.get_sea_height()` — detects water surface
   - `cshelph.get_water_temp()` — fetches SST from GHRSST via earthaccess
   - `cshelph.refraction_correction()` — full Parrish et al. 2019 correction
   - `cshelph.get_bath_height()` — classifies bathymetry photons using density threshold
5. Returns classified, refraction-corrected bathymetry photons
6. Frontend displays results on interactive map + 3D view

## Requirements

**NASA EarthData account** — register at https://urs.earthdata.nasa.gov/

## Deploy to Railway

1. Push to GitHub
2. Railway → New Project → Deploy from GitHub
3. **Set environment variables** in Railway dashboard:
   - `EARTHDATA_USERNAME` — your NASA EarthData username
   - `EARTHDATA_PASSWORD` — your NASA EarthData password
4. Deploy

### Railway CLI
```bash
railway login
railway init
railway up
```

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
export EARTHDATA_USERNAME=your_user
export EARTHDATA_PASSWORD=your_pass
python app.py
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

## Architecture

```
backend/app.py          → Flask API calling real cshelph functions
backend/requirements.txt → cshelph + earthaccess + all dependencies
frontend/               → React + Leaflet + Three.js
Dockerfile              → Multi-stage: Node builds React, Python runs cshelph
railway.toml            → Railway deploy config
```

## Algorithm Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| laser | 1 | ICESat-2 beam pair (1-3), selects strong beam |
| density_threshold | 20 | Percentile for photon density classification |
| surface_buffer | -0.5m | Height cutoff for surface detection |
| lat_resolution | 10m | Horizontal bin size (along-track) |
| height_resolution | 0.5m | Vertical bin size |
| water_temp | auto | SST in °C (auto-fetched from GHRSST if not set) |

## Citation

Thomas, N. et al. (2022). "A purely spaceborne open source approach for regional bathymetry mapping." IEEE GRSL.

Original: https://github.com/nmt28/C-SHELPh
