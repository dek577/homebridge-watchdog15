
const debug = require('debug')('watchdog15')
const snmp = require("snmp-native")
const nodeCache = require( "node-cache" )
const moment = require('moment')
const os = require("os")

const DATA = "data";
const OLD_DATA = 'old_data';

const OIDS = {
    ProductPlatform: '1.3.6.1.4.1.21239.5.1.1.11.0',
    SerialNumber: '1.3.6.1.4.1.21239.5.1.1.10.0',
    PartNumber: '1.3.6.1.4.1.21239.5.1.1.9.0',
    ModelNumber: '1.3.6.1.4.1.21239.5.1.1.8.0',
    TempUnits: '1.3.6.1.4.1.21239.5.1.1.7.0',
    DeviceCount: '1.3.6.1.4.1.21239.5.1.1.6.0',
    MacAddress: '1.3.6.1.4.1.21239.5.1.1.4.0',
    FriendlyName: '1.3.6.1.4.1.21239.5.1.1.3.0',
    ProductVersion: '1.3.6.1.4.1.21239.5.1.1.2.0',
    ProductTitle: '1.3.6.1.4.1.21239.5.1.1.1.0',
    InternalAvail: '1.3.6.1.4.1.21239.5.1.2.1.4.1',
    InternalTemp: '1.3.6.1.4.1.21239.5.1.2.1.5.1',
    InternalHumidity: '1.3.6.1.4.1.21239.5.1.2.1.6.1',
    InternalDewpoint: '1.3.6.1.4.1.21239.5.1.2.1.7.1',
};

//let CustomCharacteristic;

module.exports = homebridge => {
    // Homekit Services and Characteristics
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic

    // History Service
    FakeGatoHistoryService = require("fakegato-history")(homebridge)

    // Register the accessory
    homebridge.registerAccessory("homebridge-watchdog15", "Watchdog15", Watchdog15)


    function Watchdog15 (_log, _config) 
    {
        debug("Init Watchdog15 Accessory")

        this.log = _log;
        this.config = _config;
        this.manufacturer = 'Vertiv'

        // parse the global config 
        if (!(_config.ip)) {
            throw new Error("Missing configuration");
        } else {
            this.ip = _config.ip;
        }
        this.name = _config.name || 'Watchdog 15';

        this.warningHiTemp = parseFloat(_config.warningHiTemp) || undefined;
        this.warningLoTemp = parseFloat(_config.warningLoTemp) || undefined;
        this.warningHiHumidity = parseFloat(_config.warningHiHumidity) || undefined;
        this.warningLoHumidity  = parseFloat(_config.warningLoHumidity) || undefined;
        this.warningHiDewpoint = parseFloat(_config.warningHiDewpoint) || undefined;
        this.warningLoDewpoint  = parseFloat(_config.warningLoDewpoint) || undefined;

        // TTL refresh defaults to 60 seconds unless otherwise noted
        this.cacheTTL = _config.updateInterval || 60;

        debug("Config:", JSON.stringify(_config));

        // Initialize the SNMP Connection 
        this.log('WD15 configured on', this.ip)
        this.session = new snmp.Session({ host: this.config.ip});

        // set up the data cache
        this.cache = new nodeCache({ 
            stdTTL: this.cacheTTL,
            checkperiod: 1,
            useClones: false
        });
        

        // set up basic WD15 services for the internal sensor
        this.accessoryInfo = new Service.AccessoryInformation();
        this.temperatureService = new Service.TemperatureSensor("Current Temperature");
        this.humidityService = new Service.HumiditySensor("Humidity");
        this.dewpointService = new Service.TemperatureSensor("Dew Point", "Dew Point");
        this.historyService = new FakeGatoHistoryService("room", this, {
            storage: "fs",
            length: Math.pow(2, 14),
            path: homebridge.user.cachedAccessoryPath(),
            filename: os.hostname().split(".")[0] + "_watchdog15_persist.json",
            disableTimer: false,
        });
        this.lastUpdate = undefined;

        // set up auto refresh
        this.enableAutoRefresh();
    }

    Watchdog15.prototype =
    {
        // get the temperature of the internal sensor
        getTemperature: function (callback) 
        {
            debug("Get Temperature Requested");
            
            this.fetchData((err, data) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, data.convertedTemp);
                }
            });
        },


        getTemperatureStatus: function (callback) 
        {
            debug("Get Temperature Status Requested");
            
            this.fetchData((err, data) => {
                if (err) {
                    callback(err);
                } else {                
                    callback(null, data.faultT);
                }
            });
        },

        // get the relative humidity of the internal sensor
        getHumidity: function (callback) 
        {
            debug("Get Humidity Requested");
            
            this.fetchData((err, data) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, data.humidity)
                }
            });
        },


        getHumidityStatus: function (callback) 
        {
            debug("Get Humidity Status Requested");
            
            this.fetchData((err, data) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, data.faultH);
                }
            });
        },

        // get the dewpoint of the internal sensor
        getDewpoint: function (callback) 
        {
            debug("Get Dewpoint Requested");
            
            this.fetchData((err, data) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, data.convertedDewpoint);
                }
            });
        },


        // get the temperature of the internal sensor
        getDewpointStatus: function (callback) 
        {
            debug("Get Dewpoint Status Requested");
            
            this.fetchData((err, data) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, data.faultD);
                }
            });
        },

        // fetch data for the response - looks in the internal cache first before going out the WD15
        fetchData: function (callback, silent) 
        {
            // grab the data from the cache
            let data = this.cache.get(DATA)

            if (data) 
            {
                // data found in the cache
                debug('Data found in Cache, data =', JSON.stringify(data))
                callback(data.error, data);
            } 
            else 
            {
                data = this.cache.get(OLD_DATA)
                if (data) 
                {
                    this.log.warn('Using expired data', JSON.stringify(data))
                    callback(data.error, data);
                } 
                else 
                {
                    this.log.warn("Failed to fetch data")
                    callback('Failed getting data');
                }
            }
        },

        // use SNMP to get data from the WD15
        getDataFromWD15: function (callback, silent) 
        {
            debug('Fetching data via SNMP and updating Cache...')
         
            var that = this;
            
            try 
            {
                let avail, temp, humidity, dewpoint, error, uom;
                error = null;

                // walk the parent subtree for all data - this picks up any updates or other changes
                that.session.getSubtree({ oid: '.1.3.6.1.4.1.21239' }, function (err, varbinds) {
                    if (err) {
                        that.log.error('SNMP ERROR Retreiving Subtree .1.3.6.1.4.1.21239:', err);
                        error = err
                    }

                    varbinds.forEach(function (vb) {
                        //console.log(vb.oid + ' = ' + vb.value + ' (' + vb.type + ')')
                        switch (vb.oid.join('.')) {
                            case OIDS.InternalTemp:
                                temp = vb.value;
                                break;
                            case OIDS.InternalHumidity:
                                humidity = vb.value;
                                break;
                            case OIDS.InternalDewpoint:
                                dewpoint = vb.value;
                                break;
                            case OIDS.InternalAvail:
                                avail = vb.value;
                                break;
                            case OIDS.TempUnits:
                                uom = vb.value;
                                break;
                        }
                    })

                    let now = moment()

                    // perform limit checks (these are done using the same UOM as the hardware so no unit conversions are performed)
                    const thi = temp / 10.0 > that.warningHiTemp;
                    const tlo = temp / 10.0 < that.warningLoTemp;
                    const hhi = humidity > that.warningHiHumidity;
                    const hlo = humidity < that.warningLoHumidity;
                    const dhi = dewpoint / 10.0 > that.warningHiDewpoint;
                    const dlo = dewpoint / 10.0 < that.warningLowHumidity; 
                    
                    const faultT = thi || tlo ? Characteristic.StatusFault.GENERAL_FAULT : Characteristic.StatusFault.NO_FAULT;
                    const faultH = hhi || hlo ? Characteristic.StatusFault.GENERAL_FAULT : Characteristic.StatusFault.NO_FAULT;
                    const faultD = dhi || dlo ? Characteristic.StatusFault.GENERAL_FAULT : Characteristic.StatusFault.NO_FAULT;

                    // perform any unit converstions
                    const convertedTemp = uom == 0 ? that.f2c(temp/10.0) : temp / 10.0;
                    const convertedDewpoint = uom == 0 ? that.f2c(dewpoint/10.0) : dewpoint/10.0
                    
                    // store the result
                    const result = { 
                        avail, 
                        uom, 
                        temp, 
                        humidity, 
                        dewpoint, 
                        convertedTemp,
                        convertedDewpoint,
                        faultT,
                        faultH,
                        faultD,
                        error 
                    };

                    // update the cache
                    if(!that.cache.set(DATA, result)) {
                        that.log.warn('ERROR - unknown error updating internal cache')
                    } else {
                        debug('WD15', JSON.stringify(result));
                        this.lastUpdate = now
                    }

                    // add another history entry if it has been at least 10 minutes
                    that.historyService.addEntry({
                        time: now.unix(),
                        temp: convertedTemp,
                        humidity: humidity,
                        dewpoint: convertedDewpoint
                    });

                    callback(result.error, result);
                });
            } 
            catch (error) 
            {
                this.log.warn("Unable to determine state of WD15", error)

                callback(error);

                this.cache.set(DATA, {error: error});
            } 
            finally 
            {
                //
            }
        },

        f2c: function(value) {
            return ((value - 32.0) * 5.0 / 9.0);
        },

        c2f: function(value) {
            return (value * 9.0 / 5.0 + 32.0);
        },

        getServices: function () 
        {
            this.accessoryInfo
                .setCharacteristic(Characteristic.Name, this.name)
                .setCharacteristic(Characteristic.Identify, this.name)
                .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
                .setCharacteristic(Characteristic.Model, this.partNumber)
                .setCharacteristic(Characteristic.SerialNumber, this.productSerial)
                .setCharacteristic(Characteristic.FirmwareRevision, this.productVersion);

            this.temperatureService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({ minValue: -20.0, maxValue: 85.0 })
                .on("get", this.getTemperature.bind(this));

            this.temperatureService
                .getCharacteristic(Characteristic.StatusFault)
                .on("get", this.getTemperatureStatus.bind(this));

            this.humidityService
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .setProps({ minValue: 0.0, maxValue: 100.0 })
                .on("get", this.getHumidity.bind(this));

            this.humidityService
                .getCharacteristic(Characteristic.StatusFault)
                .on("get", this.getHumidityStatus.bind(this));

            this.dewpointService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({ minValue: -20.0, maxValue: 85.0})
                .on("get", this.getDewpoint.bind(this))

            this.dewpointService
                .getCharacteristic(Characteristic.StatusFault)
                .on("get", this.getDewpointStatus.bind(this))

            return [
                this.informationService,
                this.temperatureService,
                this.humidityService,
                this.dewpointService,
                this.historyService
            ];
        },

        updateCharacteristics(data) 
        {
            this.temperatureService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(data.convertedTemp);

            this.temperatureService
                .getCharacteristic(Characteristic.StatusFault)
                .updateValue(data.faultT)

            this.humidityService
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(data.humidity);

            this.humidityService
                .getCharacteristic(Characteristic.StatusFault)
                .updateValue(data.faultH)

            this.dewpointService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(data.convertedDewpoint);

            this.dewpointService
                .getCharacteristic(Characteristic.StatusFault)
                .updateValue(data.faultD)
        },

        enableAutoRefresh() 
        {
            this.log("Enabling auto-refresh every %s seconds", this.cache.options.stdTTL);

            let that = this;
            this.cache.on('expired', (key, value) => {
                debug("Cache " + key + " expired");

                that.cache.set(OLD_DATA, value, 0);

                that.getDataFromWD15((error, data) => {
                    if (!error) {
                        that.updateCharacteristics(data);
                    }
                }, true);
            });

            this.getDataFromWD15((error, data) => {
                if (!error) {
                    that.updateCharacteristics(data);
                }
            }, true);
        }
    };
};