Install node22
```
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install -y nodejs
```

Deploy backend
```
gcloud iam service-accounts create websocket-proxy-sa \
    --display-name "Service Account for WebSocket Proxy"

gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
    --member serviceAccount:websocket-proxy-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --role roles/aiplatform.user

gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/websocket-proxy

gcloud run deploy websocket-proxy \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/websocket-proxy \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --service-account websocket-proxy-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com 
```

Emulate local connection for using audio/video from a browser.
```
PUBLIC_IP="xxx.xxx.xxx.xxx.bc.googleusercontent.com"
ssh -L 3000:$PUBLIC_IP:3000 $PUBLIC_IP
```
