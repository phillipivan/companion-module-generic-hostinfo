## Generic Host Info

CPU speed, current load, free memory, load averages, system time and the uptimes are updated every second. CPU temperature is updated every 10 seconds. The rest are read once, when the module starts.

Load averages are not available on Windows, where they always read 0. System Time is in ISO 8601 format, in UTC. A value the host does not provide reads `unknown`.

CPU temperature is usually available on Linux. On Windows it often needs Companion to run as administrator, and may report a motherboard sensor rather than the CPU. On macOS it reads `unknown`.

## Variables

- **Architecture**
- **CPU Speed**
- **CPU Temperature**
- **FQDN**
- **Free Memory**
- **Free Memory (%)**
- **Load Average: 1 Minute**
- **Load Average: 5 Minute**
- **Load Average: 15 Minute**
- **Load Current**
- **Machine**
- **Module Uptime**
- **Platform**
- **Release**
- **System Time**
- **System Time Zone**
- **Total Memory**
- **Type**
- **User Name**
- **Uptime**
- **Version**
