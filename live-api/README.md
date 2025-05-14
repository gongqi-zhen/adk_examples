## Setup

1. Create a new Google cloud project.
2. Open Cloud Shell and execute the following commands.

```bash
git clone https://github.com/enakai00/adk_examples.git
cd adk_examples/live-api
./deploy.sh
```

The application URL will be shown at the end. Open it with a browser.

`Application URL: https://gemini-live-api-app-xxxxxxxx-uc.a.run.app`

**Caution**

Anyone who knows the URL of the app can access it. It is recommended to shut down the project when the demo is finished to prevent unnecessary charges.

## Development notes

Install node22
```
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install -y nodejs
```

Emulate local connection for using audio/video from a browser.
```
PUBLIC_IP="xxx.xxx.xxx.xxx.bc.googleusercontent.com"
ssh -L 3000:$PUBLIC_IP:3000 $PUBLIC_IP
```
