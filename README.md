# homebridge-watchdog15
[Homebridge](https://github.com/nfarina/homebridge) plugin for the [Vertiv Geist Watchdog15](https://www.vertiv.com/en-us/products-catalog/monitoring-control-and-management/monitoring/watchdog-15/) Temperature/Humidity Sensor

<p align="center"><img alt="" src="https://raw.githubusercontent.com/dek577/homebridge-watchdog15/master/images/image01.png?sanitize=true" width="30%"><img alt="" src="https://raw.githubusercontent.com/dek577/homebridge-watchdog15/master/images/image02.png?sanitize=true" width="30%"><img alt="" src="https://raw.githubusercontent.com/dek577/homebridge-watchdog15/master/images/image03.png?sanitize=true" width="30%"></p>


## Installation

You need to have [Homebridge](https://github.com/nfarina/homebridge) installed first - refer to the repo for instructions. Then run the following command to install homebridge-watchdog15:

```
sudo npm install -g homebridge-watchdog15
```

## Configuration

The configuration can contain the following properties:

##### Basic configuration options:

* `accessory` \<string\> **required**: Defines the plugin used and must be set to **"Watchdog15"** for this plugin
* `name` \<string\> **required**: Defines the name which is later displayed in HomeKit
* `ip` \<string\> **required**: Defines the IPv4 address of the Watchdog 15 on the local network

##### Advanced configuration options:

* `warningHiTemp` \<number\> **optional** \(Default: **"none"**): Defines a high temperature limit, which if exceeded, generates a
    fault notification in HomeKit. The value should be in the same units of measure configured in the Watchdog15 web interface.

* `warningLoTemp` \<number\> **optional** \(Default: **"none"**): Defines a low temperature limit, which if exceeded, generates a
    fault notification in HomeKit. The value should be in the same units of measure configured in the Watchdog15 web interface.

* `warningHiHumidity` \<number\> **optional** \(Default: **"none"**): Defines a high humidity limit, which if exceeded, generates a
    fault notification in HomeKit. The value should be in the same units of measure configured in the Watchdog15 web interface.

* `warningLoHumidity` \<number\> **optional** \(Default: **"none"**): Defines a low humidity limit, which if exceeded, generates a
    fault notification in HomeKit. The value should be in the same units of measure configured in the Watchdog15 web interface.

* `warningHiDewpoint` \<number\> **optional** \(Default: **"none"**): Defines a high dewpoint limit, which if exceeded, generates a
    fault notification in HomeKit. The value should be in the same units of measure configured in the Watchdog15 web interface.

* `warningLoDewpoint` \<number\> **optional** \(Default: **"none"**): Defines a low dewpoint limit, which if exceeded, generates a
    fault notification in HomeKit. The value should be in the same units of measure configured in the Watchdog15 web interface.

* `updateInterval` \<number\> **optional** \(Default: **60**\): Defines the update interval (in seconds) to refresh the data from 
   the Watchdog15. Default is **60** seconds. Homekit calls to get data between these updates will return a cached value from the
   last update.

Example config.json
```json
{
    "accessories": [
        {
            "accessory": "Watchdog15",
            "name": "Basement",
            "ip": "192.168.1.45"
        }
    ]
}
```
This accessory will create a Watchdog15 sensor with Temperature, Humidity, and Dewpoint monitoring at the IP address 192.168.1.45. It will
update the sensor state once a minute.

Advanced example config.json
```json
{
    "accessories": [
        {
            "accessory": "Watchdog15",
            "name": "Basement",
            "ip": "192.168.1.45",
            "updateInterval": 5,
            "warningHiTemp": 115,
            "warningLoTemp": 34,
            "warningHiHumidity": 70
        }
    ]
}
```
This accessory will create a Watchdog15 sensor that updates every 5 minutes with high and low alarms on temperature and a high alarm on humidity.

## TODO
- [ ] Dynamically update device information (such as firmware revision, model number, etc) from the Watchdog SNMP information


## Known Bugs

* History support for dewpoint incorrectly display temperature. The plugin uses the [fakegato-history](https://github.com/simont77/fakegato-history) module to support history.  The plugin uses the fakegato "room" accessory type which supports temperature, humidity and air quality. *There is no built-in fakegato API support for dewpoint.* So dewpoint history will incorrectly display the current temperature history. This is a known issue with no workaround unitl fakegato supports generic/arbitrary signals or dewpoint is added to one of the basic accessory types.

