const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pushupCounterElement = document.getElementById('pushup-counter');

let detector;
let poses;
let pushupCounter = 0;
let stage = 'up'; // 'up' veya 'down'

async function init() {
    console.log("Uygulama başlatılıyor...");
    try {
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        console.log("✅ PoseNet modeli başarıyla yüklendi.");

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            console.log("✅ Kamera erişimi başarılı.");

            video.addEventListener('loadeddata', () => {
                console.log("🎥 Kamera verisi yüklendi, poz tespiti başlıyor.");
                // Canvas boyutunu videonun gerçek boyutuna ayarla
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                detectPose();
            });
        } else {
            console.error("❌ Tarayıcınızda kamera erişimi desteklenmiyor.");
        }
    } catch (error) {
        console.error("❌ Başlatma sırasında kritik bir hata oluştu:", error);
        alert("Model yüklenemedi veya kamera başlatılamadı. Lütfen konsolu (F12) kontrol edin.");
    }
}

async function detectPose() {
    if (detector && video.readyState >= 2) {
        try {
            poses = await detector.estimatePoses(video, {flipHorizontal: false});
            drawCanvas();
        } catch (error) {
            console.error("❌ Poz tespiti sırasında hata:", error);
        }
    }
    // Döngüyü devam ettir
    requestAnimationFrame(detectPose);
}

function drawCanvas() {
    // 1. Kameranın mevcut karesini canvas'a çiz
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 2. Eğer bir poz tespit edildiyse, iskeleti çiz
    if (poses && poses.length > 0) {
        // console.log("🏃‍♂️ Poz tespit edildi:", poses[0].keypoints); // Çok fazla log üreteceği için kapalı
        countPushups(poses[0]);
        drawKeypoints(poses[0].keypoints);
        drawSkeleton(poses[0].keypoints);
    }
}


// --- Geri kalan fonksiyonlar aynı ---

function getAngle(p1, p2, p3) {
    const angleRad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let degrees = Math.abs(angleRad * 180 / Math.PI);
    return degrees > 180 ? 360 - degrees : degrees;
}

function countPushups(pose) {
    // Sadece sol tarafı kullanıyoruz, kameraya göre sağ kolunuz olabilir.
    const leftShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
    const leftElbow = pose.keypoints.find(k => k.name === 'left_elbow');
    const leftWrist = pose.keypoints.find(k => k.name === 'left_wrist');

    const rightShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');
    const rightElbow = pose.keypoints.find(k => k.name === 'right_elbow');
    const rightWrist = pose.keypoints.find(k => k.name === 'right_wrist');

    // Hangi taraf daha güvenilir tespit ediliyorsa onu kullanalım
    let angle = -1;
    if (leftShoulder.score > 0.5 && leftElbow.score > 0.5 && leftWrist.score > 0.5) {
        angle = getAngle(leftShoulder, leftElbow, leftWrist);
    } else if (rightShoulder.score > 0.5 && rightElbow.score > 0.5 && rightWrist.score > 0.5) {
        angle = getAngle(rightShoulder, rightElbow, rightWrist);
    }

    if (angle !== -1) {
        // Açı eşiklerini buradan ayarlayabilirsiniz
        if (angle < 90) { // Dirsek büküldüğünde (aşağı pozisyon)
            stage = 'down';
        }
        if (angle > 160 && stage === 'down') { // Dirsek düzleştiğinde (yukarı pozisyon)
            stage = 'up';
            pushupCounter++;
            pushupCounterElement.innerText = pushupCounter;
            playBeep();
        }
    }
}

function playBeep() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, context.currentTime); // C5 notası
    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.1);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1);
}

function drawKeypoints(keypoints) {
    for (const keypoint of keypoints) {
        if (keypoint.score > 0.5) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawSkeleton(keypoints) {
    const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    ctx.strokeStyle = '#00FF00'; // Yeşil
    ctx.lineWidth = 2;
    adjacentKeyPoints.forEach((pair) => {
        const [i, j] = pair;
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];
        if (kp1.score > 0.5 && kp2.score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.stroke();
        }
    });
}

// Uygulamayı başlat
init();
