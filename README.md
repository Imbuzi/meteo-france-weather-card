# Lovelace animated weather card

Originally created for the [old UI](https://community.home-assistant.io/t/custom-ui-weather-state-card-with-a-question/23008) converted by @arsaboo and @ciotlosm to [Lovelace](https://community.home-assistant.io/t/custom-ui-weather-state-card-with-a-question/23008/291) and now adapted to display all informations available in the Météo-France integration.

This card uses the awesome [animated SVG weather icons by amCharts](https://www.amcharts.com/free-animated-svg-weather-icons/).

![Weather Card](https://github.com/Imbuzi/meteo-france-weather-card/blob/master/weather-card.gif?raw=true)

Thanks for all picking this card up.

## Installation

You have 2 options, hosted or self hosted (manual).
We strongly recommend to install using the first option, as it will update itself (by the way, it needs internet).

The instructions aren't givent to install it self-hosted, as this is a standard installation procedure.

### Hosted

Add the following to resources in your lovelace config:

```yaml
resources:
    url: https://cdn.jsdelivr.net/gh/Imbuzi/meteo-france-weather-card/dist/meteo-france-weather-card.js
    type: module
```

You can also specify a specific tag or version in the URL by adding @x.x :

```yaml
resources:
    url: https://cdn.jsdelivr.net/gh/Imbuzi/meteo-france-weather-card@1.1/dist/meteo-france-weather-card.js
    type: module
```

## Configuration

And add a card with type `custom:meteo-france-weather-card`:

```yaml
type: custom:meteo-france-weather-card
```

Then you can switch to visual editor to see the available options.

You can choose wich elements of the weather card you want to configure, only the weather entity is required for the card to work properly.

If you want to show the sunrise and sunset times, make sure the `sun` component is enabled:

```yaml
# Example configuration.yaml entry
sun:
```
