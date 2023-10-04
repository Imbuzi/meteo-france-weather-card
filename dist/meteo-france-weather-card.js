const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;

const weatherIconsDay = {
  clear: "day",
  "clear-night": "day",
  "nuit claire": "day",
  cloudy: "cloudy",
  fog: "cloudy",
  hail: "rainy-7",
  lightning: "thunder",
  "lightning-rainy": "thunder",
  partlycloudy: "cloudy-day-3",
  pouring: "rainy-6",
  rainy: "rainy-5",
  snowy: "snowy-6",
  "snowy-rainy": "rainy-7",
  sunny: "day",
  windy: "cloudy",
  "windy-variant": "cloudy-day-3",
  exceptional: "!!"
};

const weatherIconsNight = {
  ...weatherIconsDay,
  clear: "night",
  "clear-night": "night",
  sunny: "night",
  "nuit claire": "night",
  partlycloudy: "cloudy-night-3",
  "windy-variant": "cloudy-night-3"
};

const fireEvent = (node, type, detail, options) => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new Event(type, {
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    cancelable: Boolean(options.cancelable),
    composed: options.composed === undefined ? true : options.composed
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

function getWindDirectionRotation(direction) {
  let windDirections = [
    "N",//0
    "NNE",
    "NE",
    "ENE",
    "E",//90
    "ESE",
    "SE",
    "SSE",
    "S",//180
    "SSO",
    "SO",
    "OSO",
    "O",//270
    "ONO",
    "NO",
    "NNO"
  ];
  
  let name = windDirections[Math.round(direction/22.5)%16];
  return name;
}

function getVigilance(color, alertEntity) {
  let phenomenaIcons = {
    "Vent violent": "mdi:weather-windy",
    "Pluie-inondation": "mdi:weather-pouring",
    "Orages": "mdi:weather-lightning",
    "Inondation": "mdi:home-flood",
    "Neige-verglas": "mdi:weather-snowy-heavy",
    "Canicule": "mdi:weather-sunny-alert",
    "Grand-froid": "mdi:snowflake",
    "Avalanches": "mdi:image-filter-hdr",
    "Vagues-submersion": "mdi:waves"
  };
  
  if(alertEntity == undefined) {
    return [];
  }
  
  let phenomenaList = [];
  for (const [currentPhenomenon, currentPhenomenonColor] of Object.entries(alertEntity.attributes)) {
    if(currentPhenomenonColor == color) {
      phenomenaList.push([currentPhenomenon, phenomenaIcons[currentPhenomenon]]);
    }
  }
  
  return phenomenaList;
}

function getRainForecast(rainForecastEntity) {
  
  let rainForecastColors = new Map([
	    ['Temps sec', 0.1],
	    ['Pluie faible', 0.4],
	    ['Pluie modérée', 0.7],
	    ['Pluie forte', 1]
  ]);

  let rainForecastList = [];
  for (let [time, value] of Object.entries(rainForecastEntity.attributes['1_hour_forecast'])) {
    if(time != undefined && time.match(/[0-9]*min/g)) {
      time = time.replace('min', '').trim();
      rainForecastList.push([time, rainForecastColors.get(value), value]);
    }
  }
  
  return rainForecastList;
}

function hasConfigOrEntityChanged(element, changedProps) {
  if (changedProps.has("_config")) {
    return true;
  }

  const oldHass = changedProps.get("hass");
  if (oldHass) {
    return (
      oldHass.states[element._config.entity] !==
        element.hass.states[element._config.entity] ||
      oldHass.states["sun.sun"] !== element.hass.states["sun.sun"]
    );
  }

  return true;
}

function processForecast(lang, forecast) {
  if (forecast === undefined || forecast.length == 0) {
    return [];
  } else {
    let processedForecast = [];
    for (let i=0; i<forecast.length; i++) {
      const first = (i == 0);
      const notLast = (i + 1 < forecast.length);
      const date = new Date(forecast[i].datetime);
      const millisecondsInOnHour = 3600 * 1000;
      let hourMode = false;
      if (first && notLast) {
        const timediff = new Date(forecast[i+1].datetime) - date;
        hourMode = (timediff == millisecondsInOnHour);
      } else if (!first) {
        const timediff = date - new Date(forecast[i-1].datetime);
        hourMode = (timediff == millisecondsInOnHour);
      }

      processedForecast.push({
        formattedDate: hourMode ? date.toLocaleTimeString(lang, {hour: "2-digit"}) : date.toLocaleDateString(lang, {weekday: "short"}),
        condition: forecast[i].condition.toLowerCase(),
        temperature: forecast[i].temperature,
        templow : forecast[i].templow,
        precipitation : forecast[i].precipitation
      });
    }
    return processedForecast;
  }
}

class WeatherCard extends LitElement {
  static get properties() {
    return {
      _config: {},
      hass: {}
    };
  }

  static async getConfigElement() {
    await import("./meteo-france-weather-card-editor.js");
    return document.createElement("meteo-france-weather-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define a weather entity");
    }
    this._config = config;
  }

  shouldUpdate(changedProps) {
    return hasConfigOrEntityChanged(this, changedProps);
  }

  render() {
    if (!this._config || !this.hass) {
      return html``;
    }

    const stateObj = this.hass.states[this._config.entity];
    const rainChanceObj = this.hass.states[this._config.rainChanceEntity];
    const cloudCoverObj = this.hass.states[this._config.cloudCoverEntity];
    const snowChanceObj = this.hass.states[this._config.snowChanceEntity];
    const freezeChanceObj = this.hass.states[this._config.freezeChanceEntity];
    const alertObj = this.hass.states[this._config.alertEntity];
    const rainForecastObj = this.hass.states[this._config.rainForecastEntity];
    const uvObj = this.hass.states[this._config.uvEntity];

    if (!stateObj) {
      return html`
        <style>
          .not-found {
            flex: 1;
            background-color: yellow;
            padding: 8px;
          }
        </style>
        <ha-card>
          <div class="not-found">
            Entity not available: ${this._config.entity}
          </div>
        </ha-card>
      `;
    }

    const lang = this.hass.selectedLanguage || this.hass.language;
    const processedForecast = processForecast(lang, stateObj.attributes.forecast);

    const next_rising = new Date(
      this.hass.states["sun.sun"].attributes.next_rising
    );
    const next_setting = new Date(
      this.hass.states["sun.sun"].attributes.next_setting
    );

    return html`
      ${this.renderStyle()}
      <ha-card @click="${this._handleClick}">
        <span
          class="icon bigger"
          style="background: none, url(${
            this.getWeatherIcon(
              stateObj.state.toLowerCase(),
              this.hass.states["sun.sun"].state
            )
          }) no-repeat; background-size: contain;"
          >${stateObj.state}
        </span>
        ${
          this._config.name
            ? html`
                <span class="title"> ${this._config.name} </span>
              `
            : ""
        }
        <span class="temp"
          >${
            this.getUnit("temperature") == "°F"
              ? Math.round(stateObj.attributes.temperature)
              : stateObj.attributes.temperature
          }</span
        >
        <span class="tempc"> ${this.getUnit("temperature")}</span>
        <span>
          <ul class="variations">
            <li>
              ${
                rainChanceObj != undefined
                ? html`
                  <span title="${rainChanceObj.attributes.friendly_name}" class="ha-icon"
                    ><ha-icon icon="${rainChanceObj.attributes.icon === undefined ? 'mdi:weather-rainy' : rainChanceObj.attributes.icon}"></ha-icon
                  ></span>
                  ${rainChanceObj.state}<span class="unit"> ${rainChanceObj.attributes.unit_of_measurement} </span>
                  <br />
                `
                : html`<div style="height: 24px;" ></div>`
              }
              ${
                cloudCoverObj != undefined
                ? html`
                  <span title="${cloudCoverObj.attributes.friendly_name}" class="ha-icon"
                    ><ha-icon icon="${cloudCoverObj.attributes.icon === undefined ? 'mdi:weather-cloudy' : cloudCoverObj.attributes.icon}"></ha-icon
                  ></span>
                  ${cloudCoverObj.state}<span class="unit"> ${cloudCoverObj.attributes.unit_of_measurement} </span>
                  <br />
                `
                : html`<div style="height: 24px;" ></div>`
              }
              ${
                snowChanceObj != undefined
                ? html`
                  <span title="${snowChanceObj.attributes.friendly_name}" class="ha-icon"
                    ><ha-icon icon="${snowChanceObj.attributes.icon === undefined ? 'mdi:weather-snowy' : snowChanceObj.attributes.icon}"></ha-icon
                  ></span>
                  ${snowChanceObj.state}<span class="unit"> ${snowChanceObj.attributes.unit_of_measurement} </span>
                  <br />
                `
                : html`<div style="height: 24px;" ></div>`
              }
              ${
                freezeChanceObj != undefined
                ? html`
                  <span title="${freezeChanceObj.attributes.friendly_name}" class="ha-icon"
                    ><ha-icon icon="${freezeChanceObj.attributes.icon === undefined ? 'mdi:snowflake' : freezeChanceObj.attributes.icon}"></ha-icon
                  ></span>
                  ${freezeChanceObj.state}<span class="unit"> ${freezeChanceObj.attributes.unit_of_measurement} </span>
                  <br />
                `
                : html`<div style="height: 24px;" ></div>`
              }
              <br />
              <span class="ha-icon"
                ><ha-icon icon="mdi:weather-sunset-up"></ha-icon
              ></span>
              ${next_rising.toLocaleTimeString()}
            </li>
            <li>
              <span class="ha-icon"
                ><ha-icon icon="mdi:weather-windy"></ha-icon
              ></span>
              ${stateObj.attributes.wind_speed}<span class="unit">
                ${this.getUnit("length")}/h
              </span>
              <br />
              ${
                stateObj.attributes.wind_bearing != undefined
                ? html`
                  <span class="ha-icon"
                    ><ha-icon icon="mdi:navigation" style="transform: rotate(${stateObj.attributes.wind_bearing - 180}deg); display: inline-block;"></ha-icon
                  ></span>
                `
                : html`<div style="height: 24px;" ></div>`
              }
              ${
                stateObj.attributes.wind_bearing != undefined
                ? html`
                  ${getWindDirectionRotation(stateObj.attributes.wind_bearing)}
                  <br />
                  <div style="height: 24px;" ></div>
                `
                : html`<div style="height: 24px;" ></div>`
              }
              ${
                uvObj != undefined
                ? html`
                  <span title="${uvObj.attributes.friendly_name}" class="ha-icon"
                    ><ha-icon icon="${uvObj.attributes.icon === undefined ? 'mdi:sunglasses' : uvObj.attributes.icon}"></ha-icon
                  ></span>
                  UV ${uvObj.state}
                  <br />
                `
                : html`<div style="height: 24px;" ></div>`
              }
              <br />
              <span class="ha-icon"
                ><ha-icon icon="mdi:weather-sunset-down"></ha-icon
              ></span>
              ${next_setting.toLocaleTimeString()}
            </li>
          </ul>
        </span>
        ${
          rainForecastObj != undefined
          ? html`
            <div class="pluie">
              ${
                  html`
                      ${
                        getRainForecast(rainForecastObj).map(
                          forecast => html`
                            <div class="pluie-element" style="opacity: ${forecast[1]}" title="${forecast[2] + " " + (forecast[0] == 0 ? "actuellement" : "dans " + forecast[0] + " min")}">
                            </div>
                          `
                        )
                      }
                      
                    `
              }
            </div>
          `
          : ""
        }
        ${
          getVigilance("Jaune", alertObj).length > 0
            ? html`
                <span class="vigilance jaune">
                  <ha-icon icon="mdi:alert"></ha-icon>Vigilance jaune en cours
                  <div class="vigilance-list">
                    ${
                      getVigilance("Jaune", alertObj).map(
                        phenomenon => html`
                          <ha-icon icon="${phenomenon[1]}" title="${phenomenon[0]}"></ha-icon>
                        `
                      )
                    }
                  </div>
                </span>
              `
            : ""
        }
        ${
          getVigilance("Orange", alertObj).length > 0
            ? html`
                <span class="vigilance orange">
                  <ha-icon icon="mdi:alert"></ha-icon>Vigilance orange en cours
                  <div class="vigilance-list">
                    ${
                      getVigilance("Orange", alertObj).map(
                        phenomenon => html`
                          <ha-icon icon="${phenomenon[1]}" title="${phenomenon[0]}"></ha-icon>
                        `
                      )
                    }
                  </div>
                </span>
              `
            : ""
        }
        ${
          getVigilance("Rouge", alertObj).length > 0
            ? html`
                <span class="vigilance rouge">
                  <ha-icon icon="mdi:alert"></ha-icon>Vigilance rouge en cours
                  <div class="vigilance-list">
                    ${
                      getVigilance("Rouge", alertObj).map(
                        phenomenon => html`
                          <ha-icon icon="${phenomenon[1]}" title="${phenomenon[0]}"></ha-icon>
                        `
                      )
                    }
                  </div>
                </span>
              `
            : ""
        }
        ${
          processedForecast.length > 0
            ? html`
                <div class="forecast clear">
                  ${
                    processedForecast.slice(0, 5).map(
                      element => html`
                        <div class="day">
                          <span class="dayname">
                            ${element.formattedDate}
                          </span>
                          <br /><i
                            class="icon"
                            style="background: none, url(${
                              this.getWeatherIcon(element.condition)
                            }) no-repeat; background-size: contain;"
                          ></i>
                          <br /><span class="highTemp"
                            >${element.temperature}${
                              this.getUnit("temperature")
                            }</span
                          >
                          ${
                            typeof element.templow !== 'undefined'
                              ? html`
                                  <br /><span class="lowTemp"
                                    >${element.templow}${
                                      this.getUnit("temperature")
                                    }</span
                                  >
                                `
                              : ""
                          }
                          ${
                            typeof element.precipitation !== 'undefined'
                              ? html`
                                  <br /><span class="rainForcast"
                                    >${element.precipitation}${
                                      this.getUnit("precipitation")
                                    }</span
                                  >
                                `
                              : ""
                          }
                        </div>
                      `
                    )
                  }
                </div>
              `
            : ""
        }
      </ha-card>
    `;
  }

  getWeatherIcon(condition, sun) {
    let icon = `${
      this._config.icons
        ? this._config.icons
        : "https://cdn.jsdelivr.net/gh/bramkragten/custom-ui@master/weather-card/icons/animated/"
    }${
      sun && sun == "below_horizon"
        ? weatherIconsNight[condition]
        : weatherIconsDay[condition]
    }.svg`;
    return icon;
  }

  getUnit(measure) {
    const lengthUnit = this.hass.config.unit_system.length;
    switch (measure) {
      case "air_pressure":
        return lengthUnit === "km" ? "hPa" : "inHg";
      case "length":
        return lengthUnit;
      case "precipitation":
        return lengthUnit === "km" ? "mm" : "in";
      default:
        return this.hass.config.unit_system[measure] || "";
    }
  }

  _handleClick() {
    fireEvent(this, "hass-more-info", { entityId: this._config.entity });
  }

  getCardSize() {
    return 3;
  }

  renderStyle() {
    return html`
      <style>
        ha-card {
          cursor: pointer;
          margin: auto;
          padding-top: 2.5em;
          padding-bottom: 1.3em;
          padding-left: 1em;
          padding-right: 1em;
          position: relative;
        }
        
        .pluie {
	  display: flex;
	  flex-direction: row;
	  flex-wrap: nowrap;
          height: 15px;
          padding: 0px;
          color: var(--primary-text-color);
          margin: 10px 2px;
	  overflow: hidden;
        }
        
        .pluie-element {
          width: 100%;
          background-color: var(--paper-item-icon-color);
          border-right: 1px solid var(
              --lovelace-background,
              var(--primary-background-color)
          );
        }
        
        .pluie-element:first-child {
          border-top-left-radius: 5px;
          border-bottom-left-radius: 5px;
        }
        
        .pluie-element:last-child {
          border-top-right-radius: 5px;
          border-bottom-right-radius: 5px;
          border: 0;
        }

        .clear {
          clear: both;
        }

        .ha-icon {
          height: 18px;
          margin-right: 5px;
          color: var(--paper-item-icon-color);
        }
        
        .vigilance {
          display: block;
          border-radius: 5px;
          padding: 5px 10px;
          font-weight: 600;
          color: var(--primary-text-color);
          margin: 2px;
        }
        
        .vigilance ha-icon {
          margin: 0px 10px 0px 0px;
        }
        
        .vigilance-list ha-icon {
          margin: 0px;
        }
        
        .vigilance-list {
          float: right;
        }
        
        .vigilance.jaune {
          background-color: rgba(255,235,0,0.5);
        }
        
        .vigilance.orange {
          background-color: rgba(255,152,0,0.5);
        }
        
        .vigilance.rouge {
          background-color: rgba(244,67,54,0.5);
        }

        .title {
          position: absolute;
          left: 3em;
          top: 0.9em;
          font-weight: 300;
          font-size: 3em;
          color: var(--primary-text-color);
        }
        .temp {
          font-weight: 300;
          font-size: 4em;
          color: var(--primary-text-color);
          position: absolute;
          right: 1em;
          top: 0.7em;
        }

        .tempc {
          font-weight: 300;
          font-size: 1.5em;
          vertical-align: super;
          color: var(--primary-text-color);
          position: absolute;
          right: 1em;
          margin-top: -14px;
          margin-right: 7px;
        }

        .variations {
          display: flex;
          flex-flow: row wrap;
          justify-content: space-between;
          font-weight: 300;
          color: var(--primary-text-color);
          list-style: none;
          margin-top: 4.5em;
          padding: 0;
        }

        .variations li {
          flex-basis: auto;
        }

        .variations li:first-child {
          padding-left: 1em;
        }

        .variations li:last-child {
          padding-right: 1em;
        }

        .unit {
          font-size: 0.8em;
        }

        .forecast {
          width: 100%;
          margin: 0 auto;
          height: 11em;
        }

        .day {
          display: block;
          width: 20%;
          float: left;
          text-align: center;
          color: var(--primary-text-color);
          border-right: 0.1em solid #d9d9d9;
          line-height: 2;
          box-sizing: border-box;
        }

        .dayname {
          text-transform: uppercase;
        }

        .forecast .day:first-child {
          margin-left: 0;
        }

        .forecast .day:nth-last-child(1) {
          border-right: none;
          margin-right: 0;
        }

        .highTemp {
          font-weight: bold;
        }

        .lowTemp {
          font-weight: 300;
        }

        .rainForcast {
          font-weight: 300;
        }

        .icon.bigger {
          width: 10em;
          height: 10em;
          margin-top: -8.5em;
          position: absolute;
          left: 0em;
        }

        .icon {
          width: 50px;
          height: 50px;
          margin-right: 5px;
          display: inline-block;
          vertical-align: middle;
          background-size: contain;
          background-position: center center;
          background-repeat: no-repeat;
          text-indent: -9999px;
        }

        .weather {
          font-weight: 300;
          font-size: 1.5em;
          color: var(--primary-text-color);
          text-align: left;
          position: absolute;
          top: -0.5em;
          left: 6em;
          word-wrap: break-word;
          width: 30%;
        }
      </style>
    `;
  }
}
customElements.define("meteo-france-weather-card", WeatherCard);
