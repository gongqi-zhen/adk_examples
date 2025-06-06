gcloud builds submit --tag gcr.io/$GOOGLE_PROJECT_ID/bicycle-app-backend

gcloud run deploy bicycle-app-service \
--image gcr.io/$GOOGLE\*PROJECT*ID/bicycle-app-backend \
--platform managed \
--region asia-northeast1 \
--allow-unauthenticated \
--set-env-vars="GOOGLE_MAPS_API_KEY=YOUR_API_KEY,API_BASE_URL=https://\_CLOUD_RUN*.a.run.app"
