// Projede yer alan personellerin listesi
const personnelData = [
    { id: 1, name: 'Ali Veli', role: 'Proje Yöneticisi', avatarUrl: 'https://i.pravatar.cc/48?u=1' },
    { id: 2, name: 'Ayşe Kaya', role: 'Yazılım Mimarı', avatarUrl: 'https://i.pravatar.cc/48?u=2' },
    { id: 3, name: 'Mehmet Demir', role: 'Kıdemli Geliştirici', avatarUrl: 'https://i.pravatar.cc/48?u=3' },
    { id: 4, name: 'Zeynep Çelik', role: 'Ön Yüz Geliştirici', avatarUrl: 'https://i.pravatar.cc/48?u=4' },
    { id: 5, name: 'Mustafa Arslan', role: 'Arka Uç Geliştirici', avatarUrl: 'https://i.pravatar.cc/48?u=5' },
    { id: 6, name: 'Elif Doğan', role: 'Test Uzmanı', avatarUrl: 'https://i.pravatar.cc/48?u=6' },
    { id: 7, name: 'Hasan Öztürk', role: 'Veritabanı Uzmanı', avatarUrl: 'https://i.pravatar.cc/48?u=7' }
];

// Uygulama ilk yüklendiğinde veya "Verileri Sıfırla" dendiğinde kullanılacak örnek görev listesi
const initialTaskData = [
    // --- ANA AŞAMA 1: PLANLAMA ---
    {
        id: 1,
        wbs: '1',
        name: 'Proje Planlama Aşaması',
        startDate: '2025-08-04',
        endDate: '2025-08-15',
        assignedTo: [1], // Ali Veli
        parentId: 0,
        progress: 30,
        type: 'task',
        notes: 'Proje kapsamının belirlenmesi, zaman çizelgesinin oluşturulması ve kaynakların atanması.',
        predecessors: []
    },
    {
        id: 2,
        wbs: '1.1',
        name: 'Gereksinimlerin Toplanması',
        startDate: '2025-08-04',
        endDate: '2025-08-08',
        assignedTo: [2], // Ayşe Kaya
        parentId: 1, // Üst Görev ID: 1
        progress: 50,
        type: 'task',
        notes: 'Müşteri ve paydaşlarla toplantılar.',
        predecessors: [] // Bu görev planlama ile birlikte başlar, özel bir bağımlılığı yok.
    },
    {
        id: 3,
        wbs: '1.2',
        name: 'Teknik Tasarım ve Mimari',
        startDate: '2025-08-11',
        endDate: '2025-08-15',
        assignedTo: [2, 3], // Ayşe Kaya, Mehmet Demir
        parentId: 1, // Üst Görev ID: 1
        progress: 10,
        type: 'task',
        notes: 'Sistem mimarisinin ve veri modelinin tasarlanması.',
        predecessors: [{ taskId: 2, type: 'FS' }] // Görev 2 (Gereksinimler) bittikten sonra başlar (Finish-to-Start)
    },
    {
        id: 4,
        wbs: '1.M',
        name: 'Planlama Tamamlandı',
        startDate: '2025-08-15',
        endDate: '2025-08-15',
        assignedTo: [1],
        parentId: 1,
        progress: 100,
        type: 'milestone',
        notes: 'Planlama aşamasının bittiğini gösteren kilometre taşı.',
        predecessors: [{ taskId: 3, type: 'FF' }] // Görev 3 (Teknik Tasarım) bittiğinde biter (Finish-to-Finish)
    },

    // --- ANA AŞAMA 2: GELİŞTİRME ---
    {
        id: 5,
        wbs: '2',
        name: 'Geliştirme Aşaması',
        startDate: '2025-08-18',
        endDate: '2025-09-12',
        assignedTo: [1],
        parentId: 0,
        progress: 0,
        type: 'task',
        notes: 'Uygulama modüllerinin kodlanması.',
        predecessors: [{ taskId: 4, type: 'FS' }] // Görev 4 (Planlama Bitişi) bittikten sonra başlar
    },
    {
        id: 6,
        wbs: '2.1',
        name: 'Veritabanı Kurulumu',
        startDate: '2025-08-18',
        endDate: '2025-08-20',
        assignedTo: [7], // Hasan Öztürk
        parentId: 5, // Üst Görev ID: 5
        progress: 0,
        type: 'task',
        notes: '',
        predecessors: [{ taskId: 5, type: 'SS' }] // Görev 5 (Geliştirme) ile birlikte başlar (Start-to-Start)
    },
    {
        id: 7,
        wbs: '2.2',
        name: 'Kullanıcı Arayüzü (UI) Geliştirme',
        startDate: '2025-08-21',
        endDate: '2025-09-05',
        assignedTo: [4], // Zeynep Çelik
        parentId: 5,
        progress: 0,
        type: 'task',
        notes: '',
        predecessors: [{ taskId: 6, type: 'FS' }] // Görev 6 (Veritabanı) bittikten sonra başlar
    },
    {
        id: 8,
        wbs: '2.3',
        name: 'Arka Uç (Backend) Servisleri',
        startDate: '2025-08-21',
        endDate: '2025-09-05',
        assignedTo: [5], // Mustafa Arslan
        parentId: 5,
        progress: 0,
        type: 'task',
        notes: 'API ve iş mantığı kodlaması.',
        predecessors: [{ taskId: 6, type: 'FS' }] // Görev 6 (Veritabanı) bittikten sonra başlar
    },
     {
        id: 9,
        wbs: '2.4',
        name: 'Entegrasyon',
        startDate: '2025-09-08',
        endDate: '2025-09-12',
        assignedTo: [3, 4, 5],
        parentId: 5,
        progress: 0,
        type: 'task',
        notes: 'Ön yüz ve arka ucun birleştirilmesi.',
        predecessors: [
            { taskId: 7, type: 'FF' }, // Görev 7 (UI) bittiğinde biter
            { taskId: 8, type: 'FF' }  // Görev 8 (Backend) bittiğinde biter
        ]
    },

    // --- ANA AŞAMA 3: TEST ---
    {
        id: 10,
        wbs: '3',
        name: 'Test Aşaması',
        startDate: '2025-09-15',
        endDate: '2025-09-26',
        assignedTo: [6], // Elif Doğan
        parentId: 0,
        progress: 0,
        type: 'task',
        notes: 'Uygulamanın hatalara karşı test edilmesi.',
        predecessors: [{ taskId: 9, type: 'FS' }] // Görev 9 (Entegrasyon) bittikten sonra başlar
    },
    {
        id: 11,
        wbs: '3.M',
        name: 'Proje Teslimi',
        startDate: '2025-09-26',
        endDate: '2025-09-26',
        assignedTo: [1],
        parentId: 0,
        progress: 0,
        type: 'milestone',
        notes: 'Projenin müşteriye teslim edildiği tarih.',
        predecessors: [{ taskId: 10, type: 'FS' }] // Görev 10 (Test) bittikten sonra başlar
    }
];
