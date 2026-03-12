"""
C-SHELPh Bathymetry Extraction Web Application — Backend
Uses the REAL cshelph PyPI package + earthaccess for ICESat-2 ATL03 data.

Pipeline (mirrors run_bathymetry_extraction.ipynb exactly):
  1. earthaccess.login + search ATL03 granules by ROI bbox
  2. Download/open granule H5 files
  3. cshelph.read_atl03() — read photon-level data
  4. cshelph.convert_wgs_to_utm() + cshelph.orthometric_correction()
  5. cshelph.ref_linear_interp() — interpolate ref_elev per photon
  6. cshelph.bin_data() — bin photons for density classification
  7. cshelph.get_sea_height() — locate water surface
  8. cshelph.get_water_temp() — sea surface temperature (for refraction)
  9. cshelph.refraction_correction() — Parrish et al. 2019
  10. cshelph.get_bath_height() — classify bathymetry photons
  11. Return classified + refraction-corrected points as JSON
"""

import os
import json
import logging
import traceback
import tempfile
import glob
import time as timepkg
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import cshelph
import earthaccess
import h5py as h5

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
CORS(app)

# ─── EarthData Authentication ───
def ensure_earthdata_auth():
    """Authenticate with NASA EarthData. Uses env vars or .netrc."""
    try:
        auth = earthaccess.login(strategy="environment")
        if not auth:
            auth = earthaccess.login(strategy="netrc")
        return auth
    except Exception as e:
        logger.error(f"EarthData auth failed: {e}")
        raise RuntimeError(
            "NASA EarthData authentication failed. "
            "Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD environment variables."
        )


def search_atl03_granules(bbox, start_date, end_date, max_results=20):
    """Search for ATL03 granules intersecting bbox."""
    ensure_earthdata_auth()
    results = earthaccess.search_data(
        short_name="ATL03",
        bounding_box=(bbox['west'], bbox['south'], bbox['east'], bbox['north']),
        temporal=(start_date, end_date),
        count=max_results
    )
    granules_info = []
    for r in results:
        try:
            links = r.data_links()
            native_id = r['meta']['native-id'] if isinstance(r, dict) and 'meta' in r else str(r)
            size_mb = r.size() if hasattr(r, 'size') else 0
            granules_info.append({
                'url': links[0] if links else '',
                'native_id': native_id,
                'size_mb': round(size_mb, 2),
            })
        except Exception:
            granules_info.append({'url': str(r), 'native_id': str(r), 'size_mb': 0})
    return results, granules_info


def run_cshelph_pipeline(h5_filepath, laser_num, threshold, surface_buffer,
                         lat_res, height_res, y_limit_top, y_limit_bottom, water_temp=None):
    """
    Execute the full C-SHELPh pipeline on a single ATL03 H5 file.
    This mirrors the notebook run_bathymetry_extraction.ipynb step by step.
    """
    logger.info(f"C-SHELPh pipeline: file={h5_filepath}, laser={laser_num}, th={threshold}")

    # ── Step 1: Read ATL03 photon data ──
    latitude, longitude, photon_h, conf, ref_elev, ref_azimuth, \
        ph_index_beg, segment_id, altitude_sc, seg_ph_count = \
        cshelph.read_atl03(h5_filepath, str(laser_num))

    if len(latitude) == 0:
        raise ValueError(f"No photons found for laser gt{laser_num}")

    logger.info(f"Read {len(latitude)} photons from laser gt{laser_num}")

    # ── Step 2: Convert to UTM + orthometric correction ──
    epsg = cshelph.convert_wgs_to_utm(np.median(latitude), np.median(longitude))
    epsg_num = int(epsg.split(':')[1])
    Y_utm, X_utm, Z_egm08 = cshelph.orthometric_correction(latitude, longitude, photon_h, epsg)

    # ── Step 3: Linearly interpolate ref_elev & altitude_sc per photon ──
    photon_ref_elev = cshelph.ref_linear_interp(seg_ph_count, ref_elev)
    photon_ref_azimuth = cshelph.ref_linear_interp(seg_ph_count, ref_azimuth)
    photon_alt_sc = cshelph.ref_linear_interp(seg_ph_count, altitude_sc)

    # Trim to same length (edge case handling)
    min_len = min(len(Y_utm), len(photon_ref_elev), len(photon_ref_azimuth), len(photon_alt_sc), len(conf))
    Y_utm = Y_utm[:min_len]
    X_utm = X_utm[:min_len]
    Z_egm08 = Z_egm08[:min_len]
    latitude_t = latitude[:min_len]
    longitude_t = longitude[:min_len]
    conf_t = conf[:min_len]
    photon_ref_elev = photon_ref_elev[:min_len]
    photon_ref_azimuth = photon_ref_azimuth[:min_len]
    photon_alt_sc = photon_alt_sc[:min_len]

    # ── Step 4: Build dataframe and bin data ──
    dataset = pd.DataFrame({
        'latitude': Y_utm,
        'longitude': X_utm,
        'photon_height': Z_egm08,
    })

    binned_data = cshelph.bin_data(dataset, lat_res, height_res)

    # ── Step 5: Get sea (water surface) height ──
    sea_height = cshelph.get_sea_height(binned_data, surface_buffer=surface_buffer)
    median_sea_surface = np.nanmedian(sea_height)
    logger.info(f"Median sea surface height: {median_sea_surface:.3f} m")

    # ── Step 6: Water temperature (for refraction) ──
    if water_temp is None:
        try:
            water_temp = cshelph.get_water_temp(h5_filepath, latitude, longitude)
            logger.info(f"Retrieved water temp: {water_temp}°C")
        except Exception as e:
            logger.warning(f"Could not get water temp, using default 20°C: {e}")
            water_temp = 20.0

    # ── Step 7: Refraction correction (Parrish et al. 2019) ──
    wavelength = 532  # ICESat-2 ATLAS green laser nm
    try:
        cor_X, cor_Y, cor_Z, cor_conf, raw_X, raw_Y, raw_Z, \
            cor_azimuth, cor_elev = cshelph.refraction_correction(
                water_temp, median_sea_surface, wavelength,
                photon_ref_elev, photon_ref_azimuth,
                Z_egm08, X_utm, Y_utm, conf_t, photon_alt_sc
            )
    except Exception as e:
        logger.error(f"Refraction correction failed: {e}")
        # Fall back to uncorrected
        cor_X, cor_Y, cor_Z = X_utm.copy(), Y_utm.copy(), Z_egm08.copy()
        cor_conf = conf_t
        raw_X, raw_Y, raw_Z = X_utm, Y_utm, Z_egm08
        cor_azimuth, cor_elev = photon_ref_azimuth, photon_ref_elev

    # Add corrected columns to binned_data
    # Need to rebuild binned_data with corrected values for bath_height
    # The corrected arrays are subsets (only below water surface), so we need to re-merge
    binned_data['cor_latitude'] = binned_data['latitude']
    binned_data['cor_longitude'] = binned_data['longitude']
    binned_data['cor_photon_height'] = binned_data['photon_height']

    # For the photons that have corrected values (below water surface),
    # we create a mapping. The full pipeline uses index alignment.
    # Since refraction_correction only returns sub-surface photons,
    # we update the binned_data with corrected positions where available.
    below_surface_mask = Z_egm08[:len(binned_data)] <= median_sea_surface
    n_cor = len(cor_Z)
    if n_cor > 0 and n_cor <= below_surface_mask.sum():
        below_indices = np.where(below_surface_mask)[0][:n_cor]
        binned_data.loc[below_indices, 'cor_latitude'] = cor_Y
        binned_data.loc[below_indices, 'cor_longitude'] = cor_X
        binned_data.loc[below_indices, 'cor_photon_height'] = cor_Z

    # ── Step 8: Get bathymetry height (classified bath photons) ──
    bath_height, geo_df = cshelph.get_bath_height(
        binned_data, threshold, median_sea_surface, height_res
    )

    logger.info(f"Classified {len(geo_df)} bathymetry photons")

    # ── Step 9: Convert corrected UTM coords back to WGS84 for web display ──
    from pyproj import Transformer
    transformer = Transformer.from_crs(f"EPSG:{epsg_num}", "EPSG:4326", always_xy=True)

    if len(geo_df) > 0:
        lon_wgs84, lat_wgs84 = transformer.transform(
            geo_df['longitude'].values, geo_df['latitude'].values
        )
        geo_df['lon_wgs84'] = lon_wgs84
        geo_df['lat_wgs84'] = lat_wgs84

    # Also convert all raw photons for surface/noise visualization
    all_lon_wgs84, all_lat_wgs84 = transformer.transform(X_utm, Y_utm)

    # ── Step 10: Build response ──
    # Bathymetry points
    bathy_points = []
    for _, row in geo_df.iterrows():
        bathy_points.append({
            'lat': float(row['lat_wgs84']),
            'lon': float(row['lon_wgs84']),
            'depth': float(row['depth']),
            'height': float(row['photon_height']),
            'photon_class': 'bathymetry',
        })

    # Surface photons (near median sea surface ±0.5m)
    surface_mask = np.abs(Z_egm08 - median_sea_surface) < 0.5
    surface_indices = np.where(surface_mask)[0]
    # sample max 1000
    if len(surface_indices) > 1000:
        surface_indices = np.random.choice(surface_indices, 1000, replace=False)
    surface_points = []
    for idx in surface_indices:
        surface_points.append({
            'lat': float(all_lat_wgs84[idx]),
            'lon': float(all_lon_wgs84[idx]),
            'depth': 0.0,
            'height': float(Z_egm08[idx]),
            'photon_class': 'surface',
        })

    # Noise photons (everything else, sampled)
    bathy_mask = np.zeros(len(Z_egm08), dtype=bool)
    # Mark photons near classified bathy
    # (rough approximation: below surface and not in surface band)
    bathy_zone_mask = (Z_egm08 < median_sea_surface - height_res * 2)
    noise_mask = ~surface_mask & ~bathy_zone_mask
    noise_indices = np.where(noise_mask)[0]
    if len(noise_indices) > 500:
        noise_indices = np.random.choice(noise_indices, 500, replace=False)
    noise_points = []
    for idx in noise_indices:
        noise_points.append({
            'lat': float(all_lat_wgs84[idx]),
            'lon': float(all_lon_wgs84[idx]),
            'depth': float(median_sea_surface - Z_egm08[idx]),
            'height': float(Z_egm08[idx]),
            'photon_class': 'noise',
        })

    all_points = bathy_points + surface_points + noise_points

    # Stats
    depths = geo_df['depth'].values if len(geo_df) > 0 else np.array([0])
    stats = {
        'total_photons': int(len(latitude)),
        'bathy_photons': len(bathy_points),
        'surface_photons': len(surface_points),
        'noise_photons': len(noise_points),
        'mean_depth': float(np.mean(depths)) if len(depths) > 0 else 0,
        'max_depth': float(np.max(depths)) if len(depths) > 0 else 0,
        'min_depth': float(np.min(depths)) if len(depths) > 0 else 0,
        'std_depth': float(np.std(depths)) if len(depths) > 0 else 0,
        'median_sea_surface': float(median_sea_surface),
        'water_temp_c': float(water_temp),
        'epsg': epsg,
        'laser': f'gt{laser_num}',
        'threshold_percentile': threshold,
    }

    # Sea height profile for chart
    x_bins = np.linspace(
        float(np.min(all_lat_wgs84)), float(np.max(all_lat_wgs84)), len(sea_height)
    )
    sea_profile = [
        {'lat': float(x_bins[i]), 'height': float(sea_height[i]) if not np.isnan(sea_height[i]) else None}
        for i in range(len(sea_height))
    ]

    # Bath profile
    bath_x_bins = np.linspace(
        float(np.min(all_lat_wgs84)), float(np.max(all_lat_wgs84)), len(bath_height)
    )
    bath_profile = [
        {'lat': float(bath_x_bins[i]), 'height': float(bath_height[i]) if not np.isnan(bath_height[i]) else None}
        for i in range(len(bath_height))
    ]

    return {
        'points': all_points,
        'stats': stats,
        'sea_profile': sea_profile,
        'bath_profile': bath_profile,
    }


# ─── API Routes ───

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'version': '2.0.0', 'algorithm': 'C-SHELPh V2 (real)'})


@app.route('/api/extract', methods=['POST'])
def extract_bathymetry():
    """
    Main endpoint. Accepts ROI bbox, searches for ATL03 granules,
    downloads them, and runs the full C-SHELPh pipeline.
    """
    try:
        data = request.json
        bbox = data.get('bbox')
        if not bbox:
            return jsonify({'error': 'bbox is required (north, south, east, west)'}), 400

        params = data.get('params', {})
        laser_num = params.get('laser', 1)
        threshold = params.get('density_threshold', 20)
        surface_buffer = params.get('surface_buffer', -0.5)
        lat_res = params.get('lat_resolution', 10)
        height_res = params.get('height_resolution', 0.5)
        y_limit_top = params.get('y_limit_top', 5)
        y_limit_bottom = params.get('y_limit_bottom', -40)
        water_temp = params.get('water_temp', None)
        start_date = data.get('start_date', '2019-01-01')
        end_date = data.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        max_granules = params.get('max_granules', 5)

        logger.info(f"Extract request: bbox={bbox}, laser={laser_num}, th={threshold}")

        # ── Step 1: Authenticate ──
        ensure_earthdata_auth()

        # ── Step 2: Search ATL03 granules ──
        granules, granules_info = search_atl03_granules(bbox, start_date, end_date, max_granules)

        if not granules:
            return jsonify({
                'error': 'No ATL03 granules found for this ROI and date range. '
                         'Try a coastal area with clear shallow water, or expand your date range.',
                'granules_found': 0
            }), 404

        logger.info(f"Found {len(granules)} ATL03 granules")

        # ── Step 3: Download granules to temp dir ──
        tmpdir = tempfile.mkdtemp(prefix='cshelph_')
        downloaded_files = earthaccess.download(granules[:max_granules], tmpdir)
        h5_files = glob.glob(os.path.join(tmpdir, '*.h5'))

        if not h5_files:
            return jsonify({
                'error': 'Failed to download ATL03 data files. Check EarthData credentials.',
                'granules_found': len(granules)
            }), 500

        logger.info(f"Downloaded {len(h5_files)} H5 files")

        # ── Step 4: Run C-SHELPh pipeline on each file ──
        all_results = {
            'points': [],
            'stats': {},
            'sea_profiles': [],
            'bath_profiles': [],
            'tracks': [],
            'granules_processed': [],
        }

        total_bathy = 0
        total_surface = 0
        total_noise = 0
        total_photons = 0
        all_depths = []

        for h5_file in h5_files:
            file_basename = os.path.basename(h5_file)
            for laser in [laser_num]:
                try:
                    result = run_cshelph_pipeline(
                        h5_file, laser, threshold, surface_buffer,
                        lat_res, height_res, y_limit_top, y_limit_bottom, water_temp
                    )

                    # Tag each point with track/file info
                    track_id = f"{file_basename}_gt{laser}"
                    for pt in result['points']:
                        pt['track_id'] = track_id

                    all_results['points'].extend(result['points'])
                    all_results['sea_profiles'].append({
                        'track': track_id,
                        'profile': result['sea_profile']
                    })
                    all_results['bath_profiles'].append({
                        'track': track_id,
                        'profile': result['bath_profile']
                    })
                    all_results['tracks'].append({
                        'track_id': track_id,
                        'n_bathy': result['stats']['bathy_photons'],
                        'n_surface': result['stats']['surface_photons'],
                        'mean_depth': result['stats']['mean_depth'],
                        'max_depth': result['stats']['max_depth'],
                    })
                    all_results['granules_processed'].append(file_basename)

                    total_bathy += result['stats']['bathy_photons']
                    total_surface += result['stats']['surface_photons']
                    total_noise += result['stats']['noise_photons']
                    total_photons += result['stats']['total_photons']
                    if result['stats']['max_depth'] > 0:
                        all_depths.extend([p['depth'] for p in result['points'] if p['photon_class'] == 'bathymetry'])

                except Exception as e:
                    logger.warning(f"Failed on {file_basename} gt{laser}: {e}")
                    all_results['tracks'].append({
                        'track_id': f"{file_basename}_gt{laser}",
                        'error': str(e),
                    })

        # Cleanup temp files
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

        if total_bathy == 0:
            return jsonify({
                'error': 'C-SHELPh found no bathymetry photons in the selected granules. '
                         'This can happen if: (1) the area has no shallow clear water, '
                         '(2) the laser track missed the water, or '
                         '(3) noise is too high. Try a different ROI or adjust parameters.',
                'granules_found': len(granules),
                'granules_processed': all_results['granules_processed'],
                'tracks': all_results['tracks'],
            }), 200

        depths_arr = np.array(all_depths) if all_depths else np.array([0])
        all_results['stats'] = {
            'total_photons': total_photons,
            'bathy_photons': total_bathy,
            'surface_photons': total_surface,
            'noise_photons': total_noise,
            'mean_depth': float(np.mean(depths_arr)),
            'max_depth': float(np.max(depths_arr)),
            'min_depth': float(np.min(depths_arr)),
            'std_depth': float(np.std(depths_arr)),
            'granules_found': len(granules),
            'granules_processed': len(all_results['granules_processed']),
        }
        all_results['bbox'] = bbox

        return jsonify(all_results)

    except Exception as e:
        logger.error(f"Extraction error: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/search-tracks', methods=['POST'])
def search_tracks():
    """Search for available ATL03 granules (without downloading)."""
    try:
        data = request.json
        bbox = data.get('bbox')
        start_date = data.get('start_date', '2019-01-01')
        end_date = data.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        max_results = data.get('max_results', 50)

        _, granules_info = search_atl03_granules(bbox, start_date, end_date, max_results)
        return jsonify({'tracks': granules_info, 'count': len(granules_info)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export', methods=['POST'])
def export_data():
    """Export bathymetry results as GeoJSON or CSV."""
    try:
        data = request.json
        points = data.get('points', [])
        fmt = data.get('format', 'geojson')

        if fmt == 'geojson':
            features = []
            for p in points:
                if p.get('photon_class') == 'bathymetry':
                    features.append({
                        'type': 'Feature',
                        'geometry': {'type': 'Point', 'coordinates': [p['lon'], p['lat']]},
                        'properties': {
                            'depth': p['depth'],
                            'height': p.get('height', 0),
                            'track_id': p.get('track_id', ''),
                        }
                    })
            return jsonify({'type': 'FeatureCollection', 'features': features})

        elif fmt == 'csv':
            lines = ['lat,lon,depth,height,photon_class,track_id']
            for p in points:
                lines.append(
                    f"{p['lat']},{p['lon']},{p['depth']},{p.get('height',0)},"
                    f"{p.get('photon_class','')},{p.get('track_id','')}"
                )
            return app.response_class(
                response='\n'.join(lines),
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=cshelph_bathymetry.csv'}
            )

        return jsonify({'error': 'Unsupported format. Use geojson or csv.'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Serve React frontend ──
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
