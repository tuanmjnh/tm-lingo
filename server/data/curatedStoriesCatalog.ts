import type { StoryBook, StoryCategoryKey } from '../../packages/contracts/types';

export interface CuratedStoryBlueprint {
  externalId: string;
  category: StoryCategoryKey;
  ageBands: string[];
  author: string;
  coverAssetRef: string;
  estimatedMinutes: number;
  titles: { vi: string; en: string };
  summaries: { vi: string; en: string };
  segments: Array<{
    assetRef: string;
    en: string;
    vi: string;
    noteEn: string;
    noteVi: string;
  }>;
}

export const CURATED_BILINGUAL_STORIES: CuratedStoryBlueprint[] = [
  {
    externalId: 'tortoise-and-hare',
    category: 'fables',
    ageBands: ['3-5', '6-8'],
    author: 'Aesop (Song ngữ Việt – Anh)',
    coverAssetRef: 'img-story-sunny-farm',
    estimatedMinutes: 3,
    titles: {
      vi: 'Rùa và Thỏ Thi Chạy',
      en: 'The Tortoise and the Hare',
    },
    summaries: {
      vi: 'Câu chuyện ngụ ngôn kinh điển về sự kiên trì, bình tĩnh và không bao giờ bỏ cuộc.',
      en: 'A classic fable about steady effort, kindness, and never giving up.',
    },
    segments: [
      {
        assetRef: 'img-story-sunny-farm',
        en: 'One sunny morning, a fast hare laughed at a little tortoise walking slowly on the meadow.',
        vi: 'Một buổi sáng đầy nắng, chú thỏ chạy nhanh cười nhạo bạn rùa nhỏ đang bước từng bước chậm rãi trên đồng cỏ.',
        noteEn: 'Notice the contrast between fast and slow.',
        noteVi: 'Bé làm quen cặp từ đối lập: nhanh (fast) và chậm (slow).',
      },
      {
        assetRef: 'img-duck',
        en: 'The tortoise smiled calmly and invited the hare to a friendly race to the big oak tree.',
        vi: 'Rùa con mỉm cười điềm tĩnh và mời thỏ cùng thi chạy vui vẻ tới gốc cây sồi lớn.',
        noteEn: 'Friendly race — a playful way to learn together.',
        noteVi: 'Thi chạy vui vẻ, không ganh đua căng thẳng.',
      },
      {
        assetRef: 'img-cat',
        en: 'The hare ran far ahead and decided to take a nap under a shady bush.',
        vi: 'Thỏ chạy vút lên rất xa rồi quyết định nằm ngủ một giấc dưới bụi cây râm mát.',
        noteEn: 'Shady bush keeps the afternoon cool.',
        noteVi: 'Bụi cây râm mát (shady bush) khiến thỏ ngủ quên.',
      },
      {
        assetRef: 'img-dog',
        en: 'Step by step, the tortoise kept walking without stopping until he crossed the finish line!',
        vi: 'Từng bước một, rùa nhỏ kiên trì đi mãi không dừng lại cho tới khi chạm vạch đích!',
        noteEn: 'Slow and steady wins the race.',
        noteVi: 'Bài học: Chậm mà chắc, kiên trì mỗi ngày sẽ về đích.',
      },
    ],
  },
  {
    externalId: 'lion-and-mouse',
    category: 'fables',
    ageBands: ['3-5', '6-8', '9-11'],
    author: 'Aesop (Song ngữ Việt – Anh)',
    coverAssetRef: 'img-cat',
    estimatedMinutes: 3,
    titles: {
      vi: 'Sư Tử và Chuột Nhắt Tốt Bụng',
      en: 'The Lion and the Kind Mouse',
    },
    summaries: {
      vi: 'Dù nhỏ bé nhưng lòng tốt và sự giúp đỡ chân thành luôn mang lại điều kỳ diệu.',
      en: 'Even the smallest friend can offer the greatest help with a kind heart.',
    },
    segments: [
      {
        assetRef: 'img-cat',
        en: 'A tiny mouse accidentally woke up a sleeping lion in the quiet green forest.',
        vi: 'Một chú chuột nhắt vô tình đánh thức bác sư tử đang ngủ say giữa khu rừng xanh yên tĩnh.',
        noteEn: 'Quiet green forest — notice the gentle adjectives.',
        noteVi: 'Bé nghe các từ tả cảnh: yên tĩnh (quiet) và xanh mát (green).',
      },
      {
        assetRef: 'img-dog',
        en: 'The little mouse promised to help the lion someday, and the gentle lion let the mouse go.',
        vi: 'Chuột nhắt hứa sẽ có ngày giúp lại bác sư tử, và sư tử tốt bụng đã thả chuột đi.',
        noteEn: 'Kindness creates lasting friendships.',
        noteVi: 'Lòng bao dung giúp kết nối những người bạn mới.',
      },
      {
        assetRef: 'img-story-sunny-farm',
        en: 'Days later, the lion got tangled in a rope net, and the little mouse hurried over to chew the ropes free.',
        vi: 'Vài ngày sau, sư tử bị vướng vào lưới dây thừng, chuột nhắt lập tức chạy đến gặm đứt dây cứu bạn.',
        noteEn: 'Small paws, big courage!',
        noteVi: 'Bàn chân nhỏ bé nhưng tấm lòng thật dũng cảm.',
      },
      {
        assetRef: 'img-duck',
        en: 'From that day on, the big lion and the tiny mouse became the very best of friends.',
        vi: 'Từ ngày hôm đó, bác sư tử to lớn và chú chuột nhắt trở thành đôi bạn thân thiết nhất rừng xanh.',
        noteEn: 'No act of kindness is ever too small.',
        noteVi: 'Không có việc tốt nào là quá nhỏ bé cả.',
      },
    ],
  },
  {
    externalId: 'starfruit-tree',
    category: 'fables',
    ageBands: ['6-8', '9-11'],
    author: 'Cổ tích Việt Nam (Song ngữ)',
    coverAssetRef: 'img-story-fruit-market',
    estimatedMinutes: 4,
    titles: {
      vi: 'Sự Tích Cây Khế',
      en: 'The Golden Starfruit Tree',
    },
    summaries: {
      vi: 'Truyện cổ tích Việt Nam quen thuộc dạy về sự chia sẻ, thật thà và tấm lòng nhân hậu.',
      en: 'A beloved Vietnamese folktale celebrating generosity, honesty, and a humble heart.',
    },
    segments: [
      {
        assetRef: 'img-story-fruit-market',
        en: 'Long ago, a kind younger brother cared lovingly for a single starfruit tree in his small garden.',
        vi: 'Ngày xửa ngày xưa, người em hiền lành chăm sóc rất chu đáo cho cây khế duy nhất trong khu vườn nhỏ.',
        noteEn: 'Starfruit gets its name from its five-pointed star shape.',
        noteVi: 'Quả khế (starfruit) khi cắt ngang có hình ngôi sao năm cánh.',
      },
      {
        assetRef: 'img-orange',
        en: 'Every autumn, the branches glowed with sweet golden starfruits shining in the sunlight.',
        vi: 'Mỗi độ thu về, cành cây trĩu nặng những quả khế chín vàng ngọt lịm dưới ánh nắng.',
        noteEn: 'Golden starfruits — warm seasonal imagery.',
        noteVi: 'Hình ảnh mùa thu ấm áp với những trái khế vàng ươm.',
      },
      {
        assetRef: 'img-duck',
        en: 'A giant magical bird visited to eat the fruit and promised: Eat one fruit, repay with gold; bring a three-span bag.',
        vi: 'Một chú chim phượng hoàng ghé ăn khế và nhắn rằng: Ăn một quả trả cục vàng, may túi ba gang mang đi mà đựng.',
        noteEn: 'The famous Vietnamese proverb in English!',
        noteVi: 'Câu nói kinh điển của truyện cổ tích Việt Nam bằng tiếng Anh.',
      },
      {
        assetRef: 'img-apple',
        en: 'Because the younger brother was honest and shared with his neighbors, his village lived happily ever after.',
        vi: 'Nhờ giữ đúng lời dặn và biết sẻ chia cùng bà con, người em và cả ngôi làng sống thật hạnh phúc.',
        noteEn: 'Generosity brings lasting joy.',
        noteVi: 'Sống hiền hòa và biết sẻ chia sẽ mang lại niềm vui bền lâu.',
      },
    ],
  },
  {
    externalId: 'little-duck-bedtime',
    category: 'bedtime',
    ageBands: ['3-5', '6-8'],
    author: 'TM-Lingo Bedtime Collection',
    coverAssetRef: 'img-duck',
    estimatedMinutes: 2,
    titles: {
      vi: 'Chú Vịt Vàng Chúc Ngủ Ngon',
      en: 'Little Duck Says Goodnight',
    },
    summaries: {
      vi: 'Truyện ngắn êm dịu với nhịp đọc chậm giúp bé thư giãn trước khi đi ngủ.',
      en: 'A soothing bedtime tale with calm words to help little learners drift off peacefully.',
    },
    segments: [
      {
        assetRef: 'img-duck',
        en: 'The golden sun waves goodbye, and the pond turns soft silver under the moon.',
        vi: 'Ông mặt trời vàng vẫy tay tạm biệt, mặt ao ánh lên màu bạc dịu êm dưới ánh trăng.',
        noteEn: 'Read in a whisper-soft voice.',
        noteVi: 'Bố mẹ có thể đọc chậm và nhỏ nhẹ cùng chế độ đi ngủ.',
      },
      {
        assetRef: 'img-cat',
        en: 'Little Duck whispers goodnight to the sleepy orange kitten curled on the porch.',
        vi: 'Vịt con thì thầm chúc ngủ ngon bạn mèo cam đang cuộn tròn trên hiên nhà.',
        noteEn: 'Goodnight, kitten!',
        noteVi: 'Lời chúc ngủ ngon thật ấm áp.',
      },
      {
        assetRef: 'img-dog',
        en: 'Little Duck waves goodnight to the puppy yawning softly beside his cozy basket.',
        vi: 'Vịt con vẫy cánh chúc ngủ ngon chú cún nhỏ đang ngáp khẽ bên chiếc giỏ êm.',
        noteEn: 'Cozy basket — a gentle bedtime phrase.',
        noteVi: 'Chiếc giỏ êm ái (cozy basket) cho giấc ngủ sâu.',
      },
      {
        assetRef: 'img-story-sunny-farm',
        en: 'Now Little Duck tucks his head under his warm wing. Sweet dreams, everyone.',
        vi: 'Giờ thì Vịt con rúc đầu vào đôi cánh ấm áp. Chúc cả nhà ngủ thật ngon nhé.',
        noteEn: 'Sweet dreams!',
        noteVi: 'Chúc bé ngủ ngon và có những giấc mơ đẹp.',
      },
    ],
  },
  {
    externalId: 'puppy-fruit-picnic',
    category: 'animals',
    ageBands: ['3-5', '6-8'],
    author: 'TM-Lingo Nature Stories',
    coverAssetRef: 'img-dog',
    estimatedMinutes: 3,
    titles: {
      vi: 'Chuyến Dã Ngoại Trái Cây Của Cún Con',
      en: 'Puppy’s Sunny Fruit Picnic',
    },
    summaries: {
      vi: 'Cùng chú cún vàng chuẩn bị giỏ táo, chuối và cam tươi cho buổi dã ngoại cùng các bạn thú.',
      en: 'Join the golden puppy as he packs apples, bananas, and oranges for a meadow picnic.',
    },
    segments: [
      {
        assetRef: 'img-dog',
        en: 'Puppy packed a woven basket for a picnic with his best animal friends.',
        vi: 'Cún con chuẩn bị một chiếc giỏ mây xinh xắn cho buổi dã ngoại cùng các bạn thú.',
        noteEn: 'Woven basket — useful everyday vocabulary.',
        noteVi: 'Làm quen từ mới: giỏ mây (woven basket) và dã ngoại (picnic).',
      },
      {
        assetRef: 'img-apple',
        en: 'First, he placed three crunchy red apples inside the basket.',
        vi: 'Đầu tiên, cún đặt ba quả táo đỏ giòn tan vào trong giỏ.',
        noteEn: 'Count aloud: one, two, three apples!',
        noteVi: 'Bé cùng đếm theo: một, hai, ba quả táo.',
      },
      {
        assetRef: 'img-banana',
        en: 'Next, Kitten brought sweet yellow bananas to share on the checkered blanket.',
        vi: 'Tiếp theo, Mèo con mang tới những quả chuối chín vàng ngọt thơm đặt lên chiếc khăn trải cỏ.',
        noteEn: 'Sharing makes every picnic sweeter.',
        noteVi: 'Chia sẻ món ngon khiến buổi dã ngoại thêm vui.',
      },
      {
        assetRef: 'img-orange',
        en: 'Duck rolled over juicy oranges, and everyone cheered under the bright blue sky!',
        vi: 'Vịt con lăn tới những quả cam mọng nước, cả nhóm cùng reo vui dưới bầu trời xanh biếc!',
        noteEn: 'Juicy oranges under the blue sky.',
        noteVi: 'Bầu trời xanh biếc (bright blue sky) và trái cam mọng nước.',
      },
    ],
  },
  {
    externalId: 'magic-thank-you',
    category: 'life-skills',
    ageBands: ['3-5', '6-8'],
    author: 'TM-Lingo Kindness Series',
    coverAssetRef: 'img-story-fruit-market',
    estimatedMinutes: 3,
    titles: {
      vi: 'Lời Cảm Ơn Kỳ Diệu',
      en: 'The Magic Thank You',
    },
    summaries: {
      vi: 'Bé khám phá sức mạnh kỳ diệu của hai tiếng "cảm ơn" và "xin lỗi" trong cuộc sống hằng ngày.',
      en: 'Discover how a warm "please" and "thank you" brighten everyone’s morning.',
    },
    segments: [
      {
        assetRef: 'img-story-fruit-market',
        en: 'At the neighborhood market, Mina politely asked: May I have one sweet orange, please?',
        vi: 'Ở khu chợ nhỏ gần nhà, bé Mina lễ phép hỏi: Cô ơi, cho con xin một quả cam ngọt với ạ?',
        noteEn: 'Polite phrase: May I have..., please?',
        noteVi: 'Mẫu câu lịch sự: May I have..., please?',
      },
      {
        assetRef: 'img-orange',
        en: 'The fruit seller smiled warmly and handed Mina the brightest orange in the crate.',
        vi: 'Cô bán trái cây mỉm cười thật ấm áp và chọn cho Mina quả cam tươi đẹp nhất sọt.',
        noteEn: 'Polite words bring warm smiles.',
        noteVi: 'Lời nói lễ phép luôn mang lại nụ cười rạng rỡ.',
      },
      {
        assetRef: 'img-apple',
        en: 'Mina said "Thank you very much!" and shared half of her snack with her little brother at home.',
        vi: 'Mina vui vẻ nói "Con cảm ơn cô nhiều ạ!" rồi về nhà chia nửa phần quà với em trai.',
        noteEn: 'Thank you very much — practice saying it clearly.',
        noteVi: 'Bé luyện nói thật rõ câu cảm ơn bằng cả hai ngôn ngữ.',
      },
    ],
  },
  {
    externalId: 'little-raindrop-journey',
    category: 'science',
    ageBands: ['6-8', '9-11'],
    author: 'TM-Lingo Discovery',
    coverAssetRef: 'img-duck',
    estimatedMinutes: 4,
    titles: {
      vi: 'Hành Trình Của Giọt Nước Nhỏ',
      en: 'The Little Raindrop’s Water Cycle',
    },
    summaries: {
      vi: 'Theo chân giọt nước nhỏ bay lên thành mây, rơi xuống thành mưa và tưới mát khu vườn xanh.',
      en: 'Follow one curious raindrop as it rises into a cloud, falls as gentle rain, and waters the garden.',
    },
    segments: [
      {
        assetRef: 'img-duck',
        en: 'Warm sunlight tickled the pond, and a tiny water droplet floated upward into the sky as invisible vapor.',
        vi: 'Ánh nắng ấm áp chạm nhẹ mặt ao, thế là giọt nước nhỏ bay lên bầu trời thành hơi nước trong suốt.',
        noteEn: 'Evaporation: water warms up and rises.',
        noteVi: 'Hiện tượng bay hơi (evaporation) trong vòng tuần hoàn nước.',
      },
      {
        assetRef: 'img-story-sunny-farm',
        en: 'High in the cool air, thousands of droplets hugged together to form a fluffy white cloud.',
        vi: 'Lên cao gặp không khí mát lạnh, hàng nghìn giọt nhỏ nắm tay nhau tạo thành đám mây trắng bông xốp.',
        noteEn: 'Condensation forms clouds in the sky.',
        noteVi: 'Ngưng tụ (condensation) tạo nên những đám mây.',
      },
      {
        assetRef: 'img-apple',
        en: 'When the cloud grew heavy, gentle raindrops tumbled down to help apple trees and flowers grow tall.',
        vi: 'Khi đám mây trở nên nặng trĩu, những hạt mưa dịu dàng rơi xuống giúp cây táo và hoa lá lớn nhanh.',
        noteEn: 'Precipitation waters plants and rivers.',
        noteVi: 'Mưa rơi tưới mát cho cây cối, ruộng đồng và sông suối.',
      },
      {
        assetRef: 'img-story-fruit-market',
        en: 'Soon the sun returned, painting a bright rainbow across the meadow before the journey began again!',
        vi: 'Chẳng mấy chốc mặt trời ló dạng, vẽ nên chiếc cầu vồng rực rỡ trước khi hành trình mới lại bắt đầu!',
        noteEn: 'Sunlight + raindrops = rainbow!',
        noteVi: 'Ánh nắng gặp giọt mưa tạo thành cầu vồng bảy sắc.',
      },
    ],
  },
  {
    externalId: 'trip-to-the-moon',
    category: 'adventure',
    ageBands: ['6-8', '9-11', '12-14'],
    author: 'TM-Lingo Explorers',
    coverAssetRef: 'img-story-sunny-farm',
    estimatedMinutes: 4,
    titles: {
      vi: 'Chuyến Phiêu Lưu Lên Mặt Trăng',
      en: 'Paper Rocket to the Moon',
    },
    summaries: {
      vi: 'Hai anh em cùng chế tạo chiếc tên lửa tưởng tượng, khám phá trọng lực nhẹ và những hố thiên thạch kỳ thú.',
      en: 'Two curious siblings imagine a rocket voyage exploring lunar craters, stars, and low gravity.',
    },
    segments: [
      {
        assetRef: 'img-story-sunny-farm',
        en: 'On Saturday afternoon, Nam and Linh built a cardboard spacecraft with shiny star stickers on the wings.',
        vi: 'Chiều thứ Bảy, Nam và Linh cùng làm một con tàu vũ trụ bằng bìa cứng gắn đầy ngôi sao lấp lánh trên cánh.',
        noteEn: 'Spacecraft — compound noun (space + craft).',
        noteVi: 'Từ ghép thú vị: spacecraft (tàu vũ trụ).',
      },
      {
        assetRef: 'img-cat',
        en: 'Three, two, one — liftoff! Their orange kitten sat proudly as the chief navigation officer.',
        vi: 'Ba, hai, một — phóng lên nào! Chú mèo cam ngồi oai vệ làm hoa tiêu trưởng của chuyến bay.',
        noteEn: 'Navigation officer guides the route.',
        noteVi: 'Hoa tiêu trưởng dẫn đường giữa các vì sao.',
      },
      {
        assetRef: 'img-dog',
        en: 'On the Moon, gravity is six times weaker than on Earth, so every small hop feels like a giant floating leap.',
        vi: 'Trên Mặt Trăng, trọng lực yếu hơn Trái Đất sáu lần nên mỗi bước nhảy nhỏ đều bồng bềnh như đang bay.',
        noteEn: 'Real science fact: lunar gravity is ~1/6 of Earth’s.',
        noteVi: 'Kiến thức khoa học: Trọng lực Mặt Trăng bằng khoảng 1/6 Trái Đất.',
      },
      {
        assetRef: 'img-banana',
        en: 'Looking back at the bright blue Earth, they promised to take good care of their home planet forever.',
        vi: 'Nhìn về hành tinh Trái Đất xanh biếc từ xa, hai anh em tự hứa sẽ luôn giữ gìn ngôi nhà chung thật xanh sạch.',
        noteEn: 'Home planet — Earth.',
        noteVi: 'Yêu quý và bảo vệ hành tinh Trái Đất.',
      },
    ],
  },
  {
    externalId: 'around-the-world-excerpt',
    category: 'classics',
    ageBands: ['12-14', '15-18'],
    author: 'Jules Verne (Bản rút gọn song ngữ)',
    coverAssetRef: 'img-story-fruit-market',
    estimatedMinutes: 5,
    titles: {
      vi: 'Vòng Quanh Thế Giới Trong 80 Ngày (Trích đoạn)',
      en: 'Around the World in Eighty Days (Adapted)',
    },
    summaries: {
      vi: 'Trích đoạn song ngữ dành cho học sinh THCS & THPT rèn đọc hiểu học thuật, từ vựng du hành và ngữ cảnh lịch sử.',
      en: 'A bilingual literary adaptation for middle and high school learners building reading fluency and travel vocabulary.',
    },
    segments: [
      {
        assetRef: 'img-story-fruit-market',
        en: 'In October 1872, Phileas Fogg calmly accepted an extraordinary wager: to circle the entire globe in just eighty days.',
        vi: 'Tháng 10 năm 1872, Phileas Fogg bình tĩnh chấp nhận một lời giao ước phi thường: đi vòng quanh Trái Đất chỉ trong 80 ngày.',
        noteEn: 'Vocabulary: extraordinary (phi thường), wager (lời giao ước/cá cược).',
        noteVi: 'Từ vựng học thuật: extraordinary, wager, circle the globe.',
      },
      {
        assetRef: 'img-story-sunny-farm',
        en: 'Armed with a railway timetable, a small carpetbag, and his loyal companion Passepartout, Fogg departed London without hesitation.',
        vi: 'Với bảng giờ tàu, một chiếc túi xách nhỏ và người đồng hành trung thành Passepartout, Fogg rời Luân Đôn không chút do dự.',
        noteEn: 'Phrase: without hesitation (không chút do dự).',
        noteVi: 'Cụm từ hay dùng trong bài viết luận: without hesitation.',
      },
      {
        assetRef: 'img-duck',
        en: 'Across steamships, mountain passes, and bustling harbors, patience and careful planning helped them overcome unexpected delays.',
        vi: 'Băng qua những chuyến tàu hơi nước, đèo núi và bến cảng nhộn nhịp, sự điềm tĩnh cùng kế hoạch chu đáo giúp họ vượt qua mọi trở ngại.',
        noteEn: 'Contrast: unexpected delays vs. careful planning.',
        noteVi: 'Cách nối ý mạch lạc bằng danh từ trừu tượng.',
      },
      {
        assetRef: 'img-orange',
        en: 'By traveling eastward across every time zone, they gained an entire calendar day — proving that curiosity and geography work hand in hand.',
        vi: 'Nhờ đi về hướng Đông qua các múi giờ, họ có thêm trọn một ngày trên lịch — minh chứng cho sự kỳ diệu của địa lý và tinh thần khám phá.',
        noteEn: 'Idiom: work hand in hand (gắn kết song hành).',
        noteVi: 'Thành ngữ: work hand in hand (gắn bó chặt chẽ, bổ trợ lẫn nhau).',
      },
    ],
  },
  {
    externalId: 'curious-scientist-notebook',
    category: 'science',
    ageBands: ['12-14', '15-18'],
    author: 'TM-Lingo Youth STEM',
    coverAssetRef: 'img-apple',
    estimatedMinutes: 5,
    titles: {
      vi: 'Cuốn Sổ Ghi Chép Của Nhà Khoa Học Trẻ',
      en: 'The Young Scientist’s Field Notebook',
    },
    summaries: {
      vi: 'Bài đọc song ngữ về phương pháp quan sát khoa học, đặt giả thuyết và kiểm chứng dành cho lứa tuổi THCS–THPT.',
      en: 'An engaging bilingual STEM reading on observation, hypothesis testing, and everyday critical thinking.',
    },
    segments: [
      {
        assetRef: 'img-apple',
        en: 'Great discoveries rarely begin with complex laboratories; they often start with a simple question about an everyday observation.',
        vi: 'Những phát minh lớn hiếm khi bắt đầu từ phòng thí nghiệm phức tạp; chúng thường khởi nguồn từ một câu hỏi giản dị về điều ta quan sát hằng ngày.',
        noteEn: 'Academic structure: rarely begin with..., often start with...',
        noteVi: 'Cấu trúc câu cân đối cho kỹ năng viết học thuật.',
      },
      {
        assetRef: 'img-orange',
        en: 'When An noticed why sliced apples turn brown while orange juice keeps them fresh, she wrote down a testable hypothesis.',
        vi: 'Khi An để ý vì sao lát táo cắt ra dễ thâm màu còn nước cam lại giữ táo tươi lâu, bạn ghi ngay một giả thuyết có thể kiểm chứng.',
        noteEn: 'Vocabulary: testable hypothesis (giả thuyết có thể kiểm chứng).',
        noteVi: 'Từ khóa STEM: observation, testable hypothesis.',
      },
      {
        assetRef: 'img-banana',
        en: 'Vitamin C acts as a natural antioxidant, slowing down the reaction between fruit enzymes and oxygen in the air.',
        vi: 'Vitamin C đóng vai trò chất chống oxy hóa tự nhiên, làm chậm phản ứng giữa enzyme trong quả và khí oxy trong không khí.',
        noteEn: 'Science concept: antioxidant & oxidation.',
        noteVi: 'Kiến thức Hóa – Sinh ứng dụng bằng tiếng Anh chuẩn xác.',
      },
      {
        assetRef: 'img-story-fruit-market',
        en: 'Recording both successes and surprises in a notebook turns curiosity into clear, evidence-based thinking.',
        vi: 'Ghi chép cả thành công lẫn kết quả bất ngờ vào sổ tay giúp biến sự tò mò thành tư duy dựa trên bằng chứng.',
        noteEn: 'Phrase: evidence-based thinking (tư duy dựa trên bằng chứng).',
        noteVi: 'Cụm từ học thuật hữu ích cho bài thuyết trình và thi chứng chỉ.',
      },
    ],
  },
];

export function buildStoryBookFromCurated(
  blueprint: CuratedStoryBlueprint,
  sourceId: string,
  sourceName: string
): StoryBook {
  const storyId = `story-src-${sourceId}-${blueprint.externalId}`;
  return {
    id: storyId,
    schemaVersion: 1,
    learningPackageId: 'lp-fruits-a1',
    ageBands: blueprint.ageBands,
    coverAssetRef: blueprint.coverAssetRef,
    availableLocales: ['en', 'vi'],
    availableExplanationLocales: ['vi', 'en'],
    titles: {
      vi: blueprint.titles.vi,
      en: blueprint.titles.en,
    },
    summaries: {
      vi: blueprint.summaries.vi,
      en: blueprint.summaries.en,
    },
    category: blueprint.category,
    sourceId,
    sourceName,
    externalId: blueprint.externalId,
    author: blueprint.author,
    status: 'published',
    publishedVersion: 1,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
    segments: blueprint.segments.map((seg, idx) => ({
      id: `${storyId}-seg-${String(idx + 1).padStart(2, '0')}`,
      order: idx + 1,
      assetRef: seg.assetRef,
      textByLocale: {
        en: seg.en,
        vi: seg.vi,
      },
      explanationByLocale: {
        vi: seg.noteVi,
        en: seg.noteEn,
      },
    })),
  };
}
