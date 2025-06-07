const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS設定はAPIエンドポイントにのみ適用する
app.use('/api', cors()); // APIパスの時だけCORSを有効化
app.use(express.json());

// Firestoreクライアントの初期化
const firestore = new Firestore();

// ルートを保存するAPIエンドポイント
app.post('/api/plans', async (req, res) => {
  try {
    const data = req.body;
    if (!data.name || !data.waypoints) {
      return res.status(400).send('必要なデータが不足しています。');
    }
    
    // Firestoreの'plans'コレクションにデータを追加
    const docRef = await firestore.collection('plans').add({
      name: data.name,
      waypoints: data.waypoints,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    });
    
    res.status(201).send({ id: docRef.id, message: 'Plan saved successfully.' });
  } catch (error) {
    console.error('Error saving plan to Firestore:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 保存されたプランの一覧を取得するAPI
app.get('/api/plans', async (req, res) => {
  try {
    // createdAt（作成日時）の降順（新しいものが上）でプランを取得
    const plansSnapshot = await firestore.collection('plans').orderBy('createdAt', 'desc').get();
    const plans = [];
    plansSnapshot.forEach(doc => {
      plans.push({
        id: doc.id, // ドキュメントID
        name: doc.data().name // プラン名
      });
    });
    res.status(200).json(plans);
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 特定のプランの詳細（ウェイポイント）を取得するAPI
app.get('/api/plans/:planId', async (req, res) => {
  try {
    const planId = req.params.planId;
    const doc = await firestore.collection('plans').doc(planId).get();

    if (!doc.exists) {
      return res.status(404).send('Plan not found');
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error getting plan details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 特定のプランを削除するAPI
app.delete('/api/plans/:planId', async (req, res) => {
  try {
    const planId = req.params.planId;
    const docRef = firestore.collection('plans').doc(planId); // ドキュメント参照を取得
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Plan not found');
    }
    await docRef.delete(); // ドキュメントを削除
    res.status(200).send('Plan deleted successfully');
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).send('Internal Server Error');
  }
}); 

const PORT = process.env.PORT || 8080;

// フロントエンド(index.html)を提供するルート
app.get('/', (req, res) => {
  const indexPath = path.resolve(__dirname, 'public', 'index.html');

  fs.readFile(indexPath, 'utf8', (err, htmlData) => {
    if (err) {
      console.error('Error reading index.html file:', err);
      return res.status(500).send('Internal Server Error');
    }

    // 環境変数から値を取得（なければローカル開発用のデフォルト値）
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || 'YOUR_LOCAL_API_KEY';
    const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${PORT}`;

    // プレースホルダーを実際の値に置換
    const renderedHtml = htmlData
      .replace(/__GOOGLE_MAPS_API_KEY__/g, googleMapsApiKey)
      .replace(/__API_BASE_URL__/g, apiBaseUrl);

    // 完成したHTMLをクライアントに送信
    res.send(renderedHtml);
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});