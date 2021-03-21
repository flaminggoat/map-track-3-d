from datetime import datetime, timezone, timedelta
from skyfield.api import EarthSatellite, load, wgs84
import csv
from math import floor

stations_url = 'http://celestrak.com/NORAD/elements/stations.txt'
satellites = load.tle_file(stations_url)
by_name = {sat.name: sat for sat in satellites}

iss = by_name['ISS (ZARYA)']

ts = load.timescale()

with open('iss.csv', 'w', newline='') as csvfile:
    fieldnames = ['time', 'lat', 'lon', 'alt']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

    writer.writeheader()

    start = datetime.now(timezone.utc) - timedelta(seconds=60*60)
    for i in range(0, 60):
        dt = start + timedelta(seconds=i*60)
        t = ts.from_datetime(dt)
        llz = wgs84.subpoint(iss.at(t))
        writer.writerow({'time': floor(dt.timestamp()), 'lat': llz.latitude.degrees, 'lon': llz.longitude.degrees, 'alt': llz.elevation.m})
        