const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pushupCounterElement = document.getElementById('pushup-counter');

let detector;
let poses;
let pushupCounter = 0;
let stage = 'up'; // 'up' veya 'down' durumunu takip eder
async function init() {
    // Pose Detection modelini yükle (MoveNet)
    const detectorConfig = {modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING};
    detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);

    // Kamerayı başlat
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
    }

    // Poz tespitini başlat
    detectPose();
}

init();
async function detectPose() {
    if (detector) {
        poses = await detector.estimatePoses(video);
        drawCanvas();
        if (poses && poses.length > 0) {
            countPushups(poses[0]);
        }
    }
    requestAnimationFrame(detectPose);
}
function drawCanvas() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (poses && poses.length > 0) {
        for (const pose of poses) {
            drawKeypoints(pose.keypoints);
            drawSkeleton(pose.keypoints);
        }
    }
}

function drawKeypoints(keypoints) {
    for (let i = 0; i < keypoints.length; i++) {
        const keypoint = keypoints[i];
        if (keypoint.score > 0.5) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawSkeleton(keypoints) {
    // İskelet çizimi için gerekli bağlantıları tanımla
    const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    
    adjacentKeyPoints.forEach((pair) => {
        const [i, j] = pair;
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        if (kp1.score > 0.5 && kp2.score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}
function getAngle(p1, p2, p3) {
    const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let degrees = Math.abs(angle * 180 / Math.PI);
    if (degrees > 180) {
        degrees = 360 - degrees;
    }
    return degrees;
}

function countPushups(pose) {
    const keypoints = pose.keypoints;
    const leftShoulder = keypoints.find(k => k.name === 'left_shoulder');
    const leftElbow = keypoints.find(k => k.name === 'left_elbow');
    const leftWrist = keypoints.find(k => k.name === 'left_wrist');

    if (leftShoulder && leftElbow && leftWrist && leftShoulder.score > 0.5 && leftElbow.score > 0.5 && leftWrist.score > 0.5) {
        const angle = getAngle(leftShoulder, leftElbow, leftWrist);
        
        // Şınav mantığı
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
    const gain = context.createGain();

    oscillator.type = 'sine'; // Sesin dalga şekli
    oscillator.frequency.setValueAtTime(440, context.currentTime); // Frekans (Hz)
    gain.gain.setValueAtTime(0.5, context.currentTime); // Ses seviyesi

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    setTimeout(() => oscillator.stop(), 100); // Sesin süresi (ms)
}
