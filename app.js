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
        console.log("✅ Model başarıyla yüklendi.");

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            console.log("✅ Kamera erişimi başarılı.");

            video.addEventListener('loadeddata', () => {
                console.log("🎥 Kamera verisi yüklendi, poz tespiti başlıyor.");
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
        poses = await detector.estimatePoses(video, {flipHorizontal: false});
        drawCanvas();
    }
    requestAnimationFrame(detectPose);
}

function drawCanvas() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (poses && poses.length > 0) {
        countPushups(poses[0]);
        drawKeypoints(poses[0].keypoints);
        drawSkeleton(poses[0].keypoints);
    }
}

function getAngle(p1, p2, p3) {
    // Güvenilirlik kontrolü: Eğer noktalardan biri tanımsızsa açı hesaplama.
    if (!p1 || !p2 || !p3) return 0;
    const angleRad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let degrees = Math.abs(angleRad * 180 / Math.PI);
    return degrees > 180 ? 360 - degrees : degrees;
}

// *** ÖN PROFİL İÇİN GÜNCELLENMİŞ FONKSİYON ***
function countPushups(pose) {
    const kp = pose.keypoints;
    const leftShoulder = kp.find(k => k.name === 'left_shoulder' && k.score > 0.5);
    const leftElbow = kp.find(k => k.name === 'left_elbow' && k.score > 0.5);
    const leftWrist = kp.find(k => k.name === 'left_wrist' && k.score > 0.5);
    
    const rightShoulder = kp.find(k => k.name === 'right_shoulder' && k.score > 0.5);
    const rightElbow = kp.find(k => k.name === 'right_elbow' && k.score > 0.5);
    const rightWrist = kp.find(k => k.name === 'right_wrist' && k.score > 0.5);

    // Her iki kolun da eklemleri görünürse açıları hesapla
    if ((leftShoulder && leftElbow && leftWrist) && (rightShoulder && rightElbow && rightWrist)) {
        const leftAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        const rightAngle = getAngle(rightShoulder, rightElbow, rightWrist);
        
        // Açı eşiklerini buradan ayarlayabilirsiniz
        const down_threshold = 90;
        const up_threshold = 160;

        // "Aşağı" durumu: Kollardan en az biri yeterince bükülmüşse
        if (leftAngle < down_threshold || rightAngle < down_threshold) {
            stage = 'down';
        }

        // "Yukarı" durumu: Her iki kol da yeterince düzleşmişse ve önceki durum "aşağı" ise
        if (leftAngle > up_threshold && rightAngle > up_threshold && stage === 'down') {
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
    oscillator.frequency.setValueAtTime(523.25, context.currentTime);
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
            ctx.fillStyle = '#FF0000'; // Kırmızı
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawSkeleton(keypoints) {
    const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    ctx.strokeStyle = '#00FF00'; // Yeşil
    ctx.lineWidth = 3;
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
