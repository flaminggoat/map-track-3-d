# MapTrack3D

A plugin for Grafana that visualizes GPS points on a 3D globe

![](https://i.imgur.com/h0vTjA7.png)

## Configuration

The plugin requires latitude,longitude, and optionally altitude measurements provided as floats in two/three separate fields
formatted by Grafana as a "Time series".

It can be used with MySQL/MariaDB as a data source by using 2/3 queries along the lines of:
```
A: SELECT "latitude" as value, $__time(timestamp) FROM "location" WHERE $__timeFilter(timestamp) ORDER BY timestamp ASC
B: SELECT "longitude" as value, $__time(timestamp) FROM "location" WHERE $__timeFilter(timestamp) ORDER BY timestamp ASC
B: SELECT "altitude" as value, $__time(timestamp) FROM "location" WHERE $__timeFilter(timestamp) ORDER BY timestamp ASC
```

## How to develop
If you don’t want to install Grafana on your local machine, you can use Docker.

To set up Grafana for plugin development using Docker, run the following command:

```
docker run -d -p 3000:3000 -v "$(pwd)"/dist:/var/lib/grafana/plugins --name=grafana grafana/grafana:7.0.0
```

Since Grafana only loads plugins on start-up, you need to restart the container whenever you add or remove a plugin.

```
docker restart grafana
```

## Attributions
Icon made by [Freepik](https://www.flaticon.com/authors/freepik) from [Flaticon](https://www.flaticon.com/)

Map Texture from [Planet Pixel Emporium](http://planetpixelemporium.com) Copyright (c) James Hastings-Trew