import NM from 'gi://NM';
import Service from './service.js';
import { bulkConnect } from '../utils.js';

const _INTERNET = (device: NM.Device) => {
    switch (device?.active_connection?.state) {
    case NM.ActiveConnectionState.ACTIVATED: return 'connected';
    case NM.ActiveConnectionState.ACTIVATING: return 'connecting';
    case NM.ActiveConnectionState.DEACTIVATING:
    case NM.ActiveConnectionState.DEACTIVATED:
    default: return 'disconnected';
    }
};

const _DEVICE_STATE = (device: NM.Device) => {
    switch (device?.state) {
    case NM.DeviceState.UNMANAGED: return 'unmanaged';
    case NM.DeviceState.UNAVAILABLE: return 'unavailable';
    case NM.DeviceState.DISCONNECTED: return 'disconnected';
    case NM.DeviceState.PREPARE: return 'prepare';
    case NM.DeviceState.CONFIG: return 'config';
    case NM.DeviceState.NEED_AUTH: return 'need_auth';
    case NM.DeviceState.IP_CONFIG: return 'ip_config';
    case NM.DeviceState.IP_CHECK: return 'ip_check';
    case NM.DeviceState.SECONDARIES: return 'secondaries';
    case NM.DeviceState.ACTIVATED: return 'activated';
    case NM.DeviceState.DEACTIVATING: return 'deactivating';
    case NM.DeviceState.FAILED: return 'failed';
    default: return 'unknown';
    }
};

class Wifi extends Service {
    static { Service.register(this); }

    _client: NM.Client;
    _device: NM.DeviceWifi;
    _ap!: NM.AccessPoint;
    _apBind!: number;

    constructor(client: NM.Client, device: NM.DeviceWifi) {
        super();
        this._client = client;
        this._device = device;

        if (this._device) {
            bulkConnect((this._device as unknown) as Service, [
                ['notify::active-access-point', this._activeAp.bind(this)],
                ['access-point-added', () => this.emit('changed')],
                ['access-point-removed', () => this.emit('changed')],
                ['notify::state', () => this.emit('changed')],
            ]);
            this._activeAp();
        }
    }

    scan() {
        this._device.request_scan_async(null, (device, res) => {
            device.request_scan_finish(res);
            this.emit('changed');
        });
    }

    _activeAp() {
        if (this._ap)
            this._ap.disconnect(this._apBind);

        this._ap = this._device.get_active_access_point();
        if (!this._ap)
            return;

        this._apBind = this._ap.connect('notify::strength', () => this.emit('changed'));
    }

    get accessPoints() {
        return this._device.get_access_points().map(ap => ({
            bssid: ap.bssid,
            address: ap.hw_address,
            lastSeen: ap.last_seen,
            ssid: ap.ssid
                ? NM.utils_ssid_to_utf8(ap.ssid.get_data() || new Uint8Array)
                : 'Unknown',
            active: ap === this._ap,
            strength: ap.strength,
        }));
    }

    get enabled() { return this._client.wireless_enabled; }
    set enabled(v) { this._client.wireless_enabled = v; }

    get strength() { return this._ap?.strength || -1; }
    get internet() { return _INTERNET(this._device); }
    get ssid() {
        if (!this._ap)
            return '';

        const ssid = this._ap.get_ssid().get_data();
        if (!ssid)
            return 'Unknown';

        return NM.utils_ssid_to_utf8(ssid);
    }

    get state() { return _DEVICE_STATE(this._device); }
}

class Wired extends Service {
    static { Service.register(this); }

    _device: NM.DeviceEthernet;

    constructor(device: NM.DeviceEthernet) {
        super();
        this._device = device;
    }

    get speed() { return this._device.get_speed(); }
    get internet() { return _INTERNET(this._device); }
    get state() { return _DEVICE_STATE(this._device); }
}

class NetworkService extends Service {
    static { Service.register(this); }

    _client!: NM.Client;
    _wifi!: Wifi;
    _wired!: Wired;
    _primary?: string;
    _connectivity!: string;

    constructor() {
        super();
        NM.Client.new_async(null, (_s, result) => {
            try {
                this._client = NM.Client.new_finish(result);
                this._clientReady();
            }
            catch (e) {
                logError(e as Error);
            }
        });
    }

    toggleWifi() {
        this._client.wireless_enabled = !this._client.wireless_enabled;
    }

    _getDevice(devType: NM.DeviceType) {
        return this._client
            .get_devices()
            .find(device => device.get_device_type() === devType);
    }

    _clientReady() {
        this._client.connect('notify::wireless-enabled', this._sync.bind(this));
        this._client.connect('notify::connectivity', this._sync.bind(this));
        this._client.connect('notify::primary-connection', this._sync.bind(this));
        this._client.connect('notify::activating-connection', this._sync.bind(this));

        this._wifi = new Wifi(this._client, this._getDevice(NM.DeviceType.WIFI) as NM.DeviceWifi);
        this._wifi.connect('changed', this._sync.bind(this));

        this._wired = new Wired(this._getDevice(NM.DeviceType.ETHERNET) as NM.DeviceEthernet);
        this._wired.connect('changed', this._sync.bind(this));

        this._sync();
    }

    _sync() {
        const mainConnection =
            this._client.get_primary_connection() ||
            this._client.get_activating_connection();

        const primary = mainConnection?.type;
        this._primary = {
            '802-11-wireless': 'wifi',
            '802-3-ethernet': 'wired',
        }[primary || ''],

        this._connectivity = {
            [NM.ConnectivityState.NONE]: 'none',
            [NM.ConnectivityState.PORTAL]: 'portal',
            [NM.ConnectivityState.LIMITED]: 'limited',
            [NM.ConnectivityState.FULL]: 'full',
        }[this._client.connectivity] || 'unknown';

        this.emit('changed');
    }
}

export default class Network {
    static { Service.export(this, 'Network'); }
    static _instance: NetworkService;

    static get instance() {
        Service.ensureInstance(Network, NetworkService);
        return Network._instance;
    }

    static toggleWifi() { Network.instance.toggleWifi(); }
    static get connectivity() { return Network.instance._connectivity; }
    static get primary() { return Network.instance._primary; }
    static get wifi() { return Network.instance._wifi; }
    static get wired() { return Network.instance._wired; }
}
