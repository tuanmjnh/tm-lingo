import type {
  StoryBook,
  StoryCategoryKey,
  StoryFormat,
} from '../../packages/contracts/types';

export interface CuratedStoryBlueprint {
  externalId: string;
  category: StoryCategoryKey;
  storyFormat?: StoryFormat;
  ageBands: string[];
  author: string;
  coverAssetRef: string;
  estimatedMinutes: number;
  titles: { vi: string; en: string };
  summaries: { vi: string; en: string };
  segments: Array<{
    assetRef: string;
    chapterTitle?: { vi: string; en: string };
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
  // ---------- Long-Form Multi-Chapter Audiobooks ----------
  {
    externalId: 'tam-cam-long-audiobook',
    category: 'fables',
    storyFormat: 'long_story',
    ageBands: ['6-8', '9-11', '12-14'],
    author: 'Cổ tích Việt Nam · Bản Sách Nói Nhiều Chương',
    coverAssetRef: 'img-story-sunny-farm',
    estimatedMinutes: 14,
    titles: {
      vi: 'Tấm Cám — Bản Đọc Dài 6 Chương',
      en: 'Tam and Cam — Complete 6-Chapter Audiobook',
    },
    summaries: {
      vi: 'Phiên bản truyện dài nhiều chương giàu cảm xúc về cô Tấm hiền hậu, chú cá bống nhỏ, đôi hài thêu và lòng kiên trì vượt qua thử thách.',
      en: 'A full multi-chapter audiobook retelling of the beloved Vietnamese folktale of Tam, her little goby fish, and the power of quiet perseverance.',
    },
    segments: [
      {
        assetRef: 'img-story-sunny-farm',
        chapterTitle: {
          vi: 'Chương 1: Hai chị em bên giếng làng',
          en: 'Chapter 1: Two Sisters by the Village Pond',
        },
        vi: 'Ngày xửa ngày xưa, ở một ngôi làng thanh bình bên rặng tre xanh, có hai chị em cùng cha khác mẹ tên là Tấm và Cám. Mẹ Tấm mất sớm, chẳng bao lâu sau cha cũng qua đời, để lại Tấm sống cùng người dì ghẻ khó tính và em gái Cám.\n\nMỗi ngày từ lúc gà vừa gáy sáng, Tấm đã thức dậy quét sân, gánh nước, chăn trâu, cắt cỏ và nấu cơm cho cả nhà. Dù công việc vất vả từ sáng tới tối mịt, cô vẫn luôn giữ nét mặt hiền hòa, nói năng dịu dàng và chăm chút cho khu vườn nhỏ quanh nhà luôn xanh tốt.',
        en: 'Long ago, in a peaceful village framed by swaying bamboo groves, lived two half-sisters named Tam and Cam. Tam lost her mother very young, and not long after, her father also passed away, leaving her in the care of a strict stepmother.\n\nEvery dawn before the rooster finished crowing, Tam swept the courtyard, carried fresh water from the well, tended the buffalo, and prepared meals. Even though her days were filled with endless chores, she remained gentle, patient, and warm-hearted toward every creature around her.',
        noteVi: 'Chương mở đầu giới thiệu bối cảnh làng quê Việt Nam và tính cách chịu thương chịu khó của Tấm.',
        noteEn: 'Opening chapter introducing the quiet Vietnamese village and Tam’s patient spirit.',
      },
      {
        assetRef: 'img-duck',
        chapterTitle: {
          vi: 'Chương 2: Chiếc yếm đỏ và người bạn cá bống',
          en: 'Chapter 2: The Crimson Sash and the Little Goby',
        },
        vi: 'Một buổi sáng đầu hạ, dì ghẻ đưa cho hai chị em mỗi người một cái giỏ và dặn ai bắt được đầy giỏ tôm tép trước sẽ được thưởng một chiếc yếm đào mới tinh. Tấm vốn quen lội đồng từ nhỏ nên cần mẫn mò cua bắt ốc chẳng mấy chốc đã đầy giỏ.\n\nThấy chị bắt được nhiều, Cám bèn nghĩ cách bảo chị ra chỗ nước sâu gội đầu cho mát rồi lén trút hết tôm tép sang giỏ mình chạy về trước. Tấm ngồi bên bờ ao buồn rầu khóc thầm, chợt Bụt hiện lên với chòm râu bạc hiền từ, chỉ cho cô thấy dưới đáy giỏ vẫn còn một chú cá bống nhỏ xíu đang vẫy đuôi.',
        en: 'One early summer morning, the stepmother handed both sisters bamboo baskets and promised a bright crimson sash to whoever filled hers with shrimp and tiny fish first. Accustomed to working in the fields, Tam waded steadily through the shallow stream and soon filled her basket to the brim.\n\nSeeing this, Cam tricked Tam into washing her hair in the deep pond while she quietly poured all of Tam’s catch into her own basket and hurried home. Sitting tearfully by the bank, Tam heard a kind voice: a wise fairy spirit appeared and pointed to one tiny goby fish still shimmering at the bottom of her basket.',
        noteVi: 'Tấm đem cá bống thả xuống giếng và mỗi bữa đều dành phần cơm gọi bống lên ăn.',
        noteEn: 'Tam releases the little fish into the well and shares her meals with it every day.',
      },
      {
        assetRef: 'img-cat',
        chapterTitle: {
          vi: 'Chương 3: Bài gọi bống bên thành giếng',
          en: 'Chapter 3: The Song at the Well',
        },
        vi: 'Từ hôm ấy, Tấm không còn cảm thấy cô đơn nữa. Mỗi bữa ăn, cô chỉ ăn hai bát còn để dành một bát cơm đem ra bên thành giếng trong xanh, cất giọng trong trẻo gọi: "Bống bống bang bang, lên ăn cơm vàng cơm bạc nhà ta, chớ ăn cơm hẩm cháo hoa nhà người."\n\nNghe tiếng gọi quen thuộc, chú cá bống nhỏ lập tức ngoi lên mặt nước, đớp từng hạt cơm trắng và vẫy đuôi lấp lánh dưới nắng mai. Nhờ tình bạn dịu dàng ấy, những buổi chiều vất vả của Tấm trở nên ấm áp hơn rất nhiều.',
        en: 'From that day onward, Tam no longer felt alone. After every meal, she saved a small bowl of rice and walked to the cool stone well, singing softly: "Little goby, rise and dine on golden rice of mine." \n\nAt the sound of her voice, the tiny fish swam right to the surface, flashing its silver scales in the morning light. That quiet daily ritual turned Tam’s hardest afternoons into moments of comfort and hope.',
        noteVi: 'Câu đồng dao "Bống bống bang bang" là một trong những hình ảnh đẹp nhất của cổ tích Việt Nam.',
        noteEn: 'The rhythmic chant calling the goby fish is a treasured motif in Vietnamese folklore.',
      },
      {
        assetRef: 'img-story-fruit-market',
        chapterTitle: {
          vi: 'Chương 4: Đàn chim sẻ giúp Tấm nhặt thóc',
          en: 'Chapter 4: The Sparrows and the Harvest Basket',
        },
        vi: 'Mùa thu tới, kinh thành mở hội lớn kéo dài ba ngày đêm, trống hội vang rền khắp các ngả đường. Trước khi dẫn Cám đi trẩy hội, dì ghẻ trộn lẫn một đấu thóc với một đấu gạo rồi bắt Tấm phải nhặt riêng hết ra mới được đi xem hội.\n\nNhìn thúng thóc gạo trộn đầy, Tấm rưng rưng nước mắt vì sợ chẳng kịp giờ. Chợt từ trên mái hiên, hàng trăm chú chim sẻ sà xuống ríu rít chia nhau nhặt từng hạt thóc tách khỏi hạt gạo chỉ trong chớp mắt. Không những thế, bộ váy áo lụa thêu hoa cùng đôi hài gấm tinh xảo cũng sẵn sàng để Tấm kịp bước chân tới lễ hội mùa thu.',
        en: 'When autumn arrived, the capital announced a grand three-day festival with drums echoing across every village road. Before setting off with Cam, the stepmother mixed a full basket of unhusked paddy with white rice and ordered Tam to separate every single grain before she could attend.\n\nOverwhelmed by the impossible task, Tam began sorting grain by grain. Suddenly, a joyful flock of sparrows fluttered down from the eaves, swiftly pecking paddy from rice until two neat piles gleamed in the sunlight. Soon after, dressed in a delicate silk gown and embroidered slippers, Tam hurried toward the glowing lanterns of the festival.',
        noteVi: 'Sự giúp đỡ của thiên nhiên và loài vật luôn dành cho người sống chân thành.',
        noteEn: 'Nature and gentle creatures rally to aid those who live with kindness.',
      },
      {
        assetRef: 'img-orange',
        chapterTitle: {
          vi: 'Chương 5: Chiếc hài rơi bên bờ suối',
          en: 'Chapter 5: The Slipper by the Clear Stream',
        },
        vi: 'Trên đường qua con suối nhỏ gần cổng kinh thành, vì bước vội nên Tấm vô tình đánh rơi một chiếc hài thêu xuống làn nước trong vắt. Dòng nước êm đềm giữ chiếc hài mắc lại bên khóm lau vàng. Chẳng bao lâu sau, đoàn voi ngựa của nhà vua đi ngang qua bỗng dừng lại bên bờ suối không chịu bước tiếp.\n\nQuân lính lội xuống tìm thì nhặt được một chiếc hài gấm nhỏ nhắn, mũi hài thêu hoa sen tinh xảo hiếm thấy. Nhà vua ngắm chiếc hài mà lòng đầy tò mò, bèn truyền lệnh cho toàn thể thiếu nữ dự hội ai đi vừa chiếc hài này sẽ được đón vào cung kết duyên.',
        en: 'Crossing a clear stream near the city gates in haste, Tam accidentally slipped one embroidered shoe into the water, where it drifted softly against a cluster of golden reeds. Shortly after, the royal procession arrived at the stream, and the king’s lead elephant refused to step forward.\n\nAttendants searched the shallow water and lifted out a tiny brocade slipper stitched with lotus blossoms. Amazed by its craftsmanship, the young king proclaimed that whoever could wear the slipper with a perfect fit would be invited to the palace.',
        noteVi: 'Chi tiết chiếc hài thêu hoa sen tạo nên điểm nhấn lãng mạn và quen thuộc với mọi thế hệ.',
        noteEn: 'The lost embroidered lotus slipper echoes classic Cinderella tales across the world.',
      },
      {
        assetRef: 'img-apple',
        chapterTitle: {
          vi: 'Chương 6: Hương thị thơm và ngày đoàn tụ',
          en: 'Chapter 6: The Fragrant Persimmon and Reunion',
        },
        vi: 'Trải qua bao biến cố và thử thách tưởng chừng không thể vượt qua, Tấm vẫn giữ trọn tấm lòng nhân hậu và đôi tay khéo léo. Từ trong quả thị vàng ươm thơm ngát nơi quán nước nhỏ của bà lão hiền lành, Tấm lại lặng lẽ giúp bà quét dọn nhà cửa, nấu nồi cơm dẻo thơm và têm những miếng trầu cánh phượng khéo léo.\n\nMột buổi chiều thu, nhà vua ghé quán nước nghỉ chân, nhận ra ngay nét têm trầu quen thuộc năm xưa. Hai người mừng rỡ đoàn tụ trong tiếng cười ấm áp. Câu chuyện khép lại với bài học sâu sắc rằng sự tử tế, nhẫn nại và niềm tin vào điều thiện sẽ luôn tìm thấy ánh sáng.',
        en: 'Through every trial that followed, Tam never lost her gentle grace or skillful hands. Sheltered inside a fragrant golden persimmon kept by a kind old teahouse keeper, she quietly helped sweep the courtyard, cook warm meals, and fold delicate betel leaves shaped like phoenix wings.\n\nOne crisp autumn afternoon, the king paused at the humble teahouse and immediately recognized her unmistakable handiwork. Reunited at last, they returned home to the cheers of the villagers—reminding every listener that patience, honesty, and quiet kindness always endure.',
        noteVi: 'Hết truyện — Bé có thể bật lại từ Chương 1 hoặc chuyển sang cuốn sách nói tiếp theo.',
        noteEn: 'End of audiobook — replay from Chapter 1 or choose another long-form book from the shelf.',
      },
    ],
  },
  {
    externalId: 'thach-sanh-long-audiobook',
    category: 'adventure',
    storyFormat: 'long_story',
    ageBands: ['6-8', '9-11', '12-14'],
    author: 'Cổ tích Việt Nam · Bản Sách Nói Nhiều Chương',
    coverAssetRef: 'img-dog',
    estimatedMinutes: 13,
    titles: {
      vi: 'Thạch Sanh & Tiếng Đàn Thần (6 Chương)',
      en: 'Thach Sanh and the Magic Lute (6 Chapters)',
    },
    summaries: {
      vi: 'Truyện dài phiêu lưu về chàng tiều phu Thạch Sanh dũng cảm, cây đàn thần kỳ diệu và niêu cơm ăn mãi không hết.',
      en: 'An epic 6-chapter Vietnamese adventure about brave woodcutter Thach Sanh, his enchanted lute, and the magical never-empty rice pot.',
    },
    segments: [
      {
        assetRef: 'img-dog',
        chapterTitle: {
          vi: 'Chương 1: Chàng tiều phu dưới gốc đa cổ thụ',
          en: 'Chapter 1: The Woodcutter Beneath the Ancient Banyan',
        },
        vi: 'Ở quận Cao Bình ngày xưa có hai vợ chồng nghèo nhưng rất hay giúp đỡ mọi người. Khi họ qua đời sớm, người con trai duy nhất tên là Thạch Sanh sống lủi thủi một mình dưới gốc cây đa lớn đầu làng, gia tài chỉ có một chiếc rìu sắt cha để lại.\n\nHằng ngày chàng lên rừng đốn củi kiếm sống. Dù nghèo khó, Thạch Sanh có sức khỏe phi thường, tấm lòng ngay thẳng và chẳng bao giờ từ chối ai khi họ cần giúp đỡ. Nhờ chăm chỉ luyện tập cùng một vị tiên ông đi ngang qua, chàng học được đủ các phép võ nghệ cao cường.',
        en: 'Long ago in the hills of Cao Binh lived a humble woodcutter named Thach Sanh. Orphaned young, he made his home beneath a towering banyan tree at the edge of the village, owning nothing but his father’s sturdy iron axe.\n\nEvery day he climbed the forest trails to gather firewood. Despite having so little, Thach Sanh possessed extraordinary strength, a fearless heart, and quiet generosity, and a passing sage taught him both martial discipline and wisdom.',
        noteVi: 'Mở đầu hành trình của người anh hùng bình dị Thạch Sanh.',
        noteEn: 'Introducing the humble and courageous hero Thach Sanh.',
      },
      {
        assetRef: 'img-story-sunny-farm',
        chapterTitle: {
          vi: 'Chương 2: Lời kết nghĩa với Lý Thông',
          en: 'Chapter 2: The Brotherhood with Ly Thong',
        },
        vi: 'Một buổi trưa nắng gắt, khi Thạch Sanh đang gánh bó củi nặng ngồi nghỉ bên vệ đường, có một người bán rượu tên là Lý Thông đi ngang qua. Thấy Thạch Sanh khỏe mạnh lại thật thà chất phác, Lý Thông liền nảy ý định kết nghĩa anh em để nhờ chàng làm việc nặng giúp mình.\n\nThạch Sanh vốn sống một mình bấy lâu, nay có người ngỏ lời làm anh em thì mừng rỡ khôn xiết. Chàng theo Lý Thông về nhà, ngày ngày chăm chỉ làm lụng không chút tính toán, hết lòng tin tưởng người anh kết nghĩa.',
        en: 'One hot midday, while resting beside a heavy bundle of firewood, Thach Sanh met a clever wine merchant named Ly Thong. Admiring Thach Sanh’s immense strength and trusting nature, Ly Thong offered to become sworn brothers.\n\nHaving lived alone for years, Thach Sanh joyfully agreed. He moved into Ly Thong’s courtyard and worked tirelessly every single day, placing complete trust in his new older brother.',
        noteVi: 'Sự tương phản giữa lòng tin chân thành của Thạch Sanh và sự tính toán của Lý Thông.',
        noteEn: 'A contrast between honest trust and selfish scheming.',
      },
      {
        assetRef: 'img-cat',
        chapterTitle: {
          vi: 'Chương 3: Đêm canh miếu và chiến công diệt chằn tinh',
          en: 'Chapter 3: The Midnight Shrine and the Forest Monster',
        },
        vi: 'Trong vùng bấy giờ có một con chằn tinh hung dữ khiến dân làng vô cùng lo sợ. Tới phiên nhà Lý Thông phải ra miếu cổ canh gác ban đêm, Lý Thông bèn nói khéo nhờ Thạch Sanh đi thay để mình ở nhà chuẩn bị hàng hóa.\n\nNửa đêm sương xuống lạnh buốt, chằn tinh gầm vang lao tới. Thạch Sanh không hề nao núng, vung cây rìu sắt chiến đấu kiên cường và tiêu diệt được quái thú, thu về cây cung vàng cùng bộ tên thần. Chàng mang chiến tích về kể cho Lý Thông mà nào hay người anh kia đã tìm cách nhận công về mình.',
        en: 'At that time, a fierce monster haunted an old mountain shrine, terrifying the entire province. When Ly Thong’s turn came to keep watch overnight, he smoothly persuaded Thach Sanh to take his place.\n\nUnder the pale midnight mist, the beast lunged from the shadows. Standing firm, Thach Sanh fought bravely with his iron axe, defeated the monster, and claimed a gleaming golden bow. Trusting as ever, he hurried back to tell Ly Thong—never suspecting Ly Thong would claim the victory for himself.',
        noteVi: 'Lòng dũng cảm giúp Thạch Sanh vượt qua nỗi sợ hãi trong đêm tối.',
        noteEn: 'Courage under pressure earns Thach Sanh the golden bow.',
      },
      {
        assetRef: 'img-duck',
        chapterTitle: {
          vi: 'Chương 4: Giải cứu công chúa dưới hang sâu',
          en: 'Chapter 4: Rescuing the Princess from the Deep Cavern',
        },
        vi: 'Ít lâu sau, một con đại bàng khổng lồ bay ngang vườn ngự uyển quắp công chúa Quỳnh Nga bay về hang đá sâu hun hút trên núi cao. Tình cờ nhìn thấy, Thạch Sanh lập tức giương cung vàng bắn một mũi tên trúng cánh đại bàng rồi lần theo dấu vết tìm tới cửa hang.\n\nChàng tự buộc dây leo xuống tận đáy vực tối đen, dũng cảm đánh bại đại bàng và đưa công chúa ra khỏi nguy hiểm. Nhưng khi công chúa vừa được kéo lên mặt đất, Lý Thông ở trên lại ra lệnh lấp kín cửa hang. Giữa hang tối, Thạch Sanh tình cờ cứu được thái tử con vua Thủy Tề bị giam giữ lâu ngày.',
        en: 'Soon after, a giant eagle swept through the royal garden and carried Princess Quynh Nga away to a deep mountain cavern. Spotting the bird in flight, Thach Sanh fired a single golden arrow to track its lair.\n\nLowering himself by rope into the dark abyss, he defeated the eagle and sent the princess safely up to the surface. Betrayed once more when Ly Thong sealed the cave entrance, Thach Sanh explored deeper and discovered the Sea King’s captive prince—whom he swiftly freed.',
        noteVi: 'Trong lúc gian khó nhất, Thạch Sanh vẫn không quên cứu giúp người gặp nạn.',
        noteEn: 'Even while trapped underground, Thach Sanh chooses to help someone in need.',
      },
      {
        assetRef: 'img-story-fruit-market',
        chapterTitle: {
          vi: 'Chương 5: Cây đàn thần dưới thủy cung',
          en: 'Chapter 5: The Enchanted Lute of the Sea Palace',
        },
        vi: 'Để cảm tạ ân nhân, vua Thủy Tề mở tiệc linh đình dưới biển sâu và mời Thạch Sanh chọn bất kỳ châu báu nào chàng thích. Thế nhưng chàng tiều phu giản dị không màng vàng bạc, chỉ xin một cây đàn gỗ mộc mạc phát ra âm thanh trong trẻo như tiếng suối reo.\n\nKhi trở về đất liền và bị giam oan trong ngục tối kinh thành, Thạch Sanh đem cây đàn ra gảy. Tiếng đàn dìu dặt vang lên khắp hoàng cung, kể lại tường tận từng chặng đường chàng đã trải qua. Công chúa từ ngày thoát nạn vốn bị câm lặng bỗng bật cười nói lại được khi nghe giai điệu chân thành ấy.',
        en: 'In gratitude, the Sea King welcomed Thach Sanh to his luminous underwater palace and offered chests of pearls and gold. Yet the modest hero declined every treasure, asking only for a simple wooden lute whose melodies sounded like clear mountain streams.\n\nLater, wrongly imprisoned in the capital, Thach Sanh softly played his lute. Its resonant notes drifted through the palace courtyards, telling the honest truth of his journey. Hearing that gentle music, the princess—who had been unable to speak since her ordeal—spoke clearly once more.',
        noteVi: 'Tiếng đàn thần là biểu tượng của sự thật, hòa bình và sức mạnh của nghệ thuật.',
        noteEn: 'The magic lute symbolizes truth, healing, and the gentle power of music.',
      },
      {
        assetRef: 'img-apple',
        chapterTitle: {
          vi: 'Chương 6: Niêu cơm thần và khúc nhạc hòa bình',
          en: 'Chapter 6: The Endless Rice Pot and Song of Peace',
        },
        vi: 'Sự thật được sáng tỏ, nhà vua gả công chúa cho Thạch Sanh và khen ngợi tấm lòng khoan dung của chàng khi tha cho mẹ con Lý Thông trở về quê cũ. Không lâu sau, quân lính mười tám nước láng giềng kéo tới biên ải gây sức ép.\n\nThạch Sanh không dùng gươm giáo mà bước lên lầu cao gảy khúc đàn thần êm dịu khiến binh sĩ bốn phương nhớ quê nhà, tự nguyện hạ vũ khí. Chàng còn mang ra một niêu cơm nhỏ xíu nhưng xới mãi không hết để thiết đãi tất cả mọi người trước khi họ vui vẻ trở về. Từ đó, đất nước sống trong hòa bình ấm no mãi mãi.',
        en: 'With the truth revealed, the king celebrated Thach Sanh’s honesty and generous spirit. When neighboring armies later gathered at the border, Thach Sanh did not draw a sword. Instead, he climbed a tall pavilion and played a tender melody of home and family on his magic lute.\n\nMoved to tears, the soldiers laid down their spears. Thach Sanh then shared a tiny magical rice pot that refilled endlessly until every single guest was warmly fed. From that day forward, peace and friendship flourished across the land.',
        noteVi: 'Hết truyện — Một cái kết nhân văn tôn vinh hòa bình và lòng bao dung.',
        noteEn: 'End of audiobook — a timeless ending celebrating peace and generosity.',
      },
    ],
  },
  {
    externalId: 'de-men-phieu-luu-ky-long',
    category: 'animals',
    storyFormat: 'long_story',
    ageBands: ['6-8', '9-11', '12-14', '15-18'],
    author: 'Cảm hứng văn học thiếu nhi Việt Nam · Sách nói 6 chương',
    coverAssetRef: 'img-story-sunny-farm',
    estimatedMinutes: 15,
    titles: {
      vi: 'Nhật Ký Phiêu Lưu Của Chú Dế Đồng Xanh (6 Chương)',
      en: 'The Green Meadow Cricket’s Adventure Journal (6 Chapters)',
    },
    summaries: {
      vi: 'Chuyến phiêu lưu dài nhiều chương của chú dế trẻ tuổi từ bãi cỏ ven đê ra thế giới rộng lớn — học về sự khiêm tốn, tình bạn và lòng dũng cảm.',
      en: 'A 6-chapter coming-of-age audiobook following a spirited young meadow cricket as he journeys beyond the grass and learns humility, empathy, and courage.',
    },
    segments: [
      {
        assetRef: 'img-story-sunny-farm',
        chapterTitle: {
          vi: 'Chương 1: Mùa hè đầu tiên ngoài hang cỏ',
          en: 'Chapter 1: First Summer Outside the Burrow',
        },
        vi: 'Tôi lớn lên trong một hang đất ấm áp nằm sâu dưới khóm cỏ may ven triền đê lộng gió. Mùa hè năm ấy, đôi càng tôi đã cứng cáp, đôi râu dài uốn cong kiêu hãnh và đôi cánh nâu bóng loáng mỗi khi tôi cất tiếng gáy giòn tan.\n\nMỗi buổi sáng, tôi thường bước ra cửa hang, vuốt râu ngắm mặt trời mọc trên đồng cỏ đầy sương sớm. Lúc ấy tôi cứ ngỡ mình đã là tay du hành vĩ đại nhất vùng, mà chưa hề biết bầu trời ngoài kia còn rộng lớn đến nhường nào.',
        en: 'I grew up in a cozy earthen burrow tucked beneath tall riverside grass. By my first bright summer, my legs felt springy and strong, my long antennae curved proudly, and my polished wings hummed whenever I chirped to the morning breeze.\n\nEach dawn I stepped onto my doorstep to watch the dew sparkle across the meadow. Back then, I imagined myself the grandest traveler in the valley, with no idea how vast the world beyond the grass truly was.',
        noteVi: 'Giọng kể ngôi thứ nhất sống động, giàu hình ảnh thiên nhiên đồng quê.',
        noteEn: 'First-person storytelling rich with vivid meadow imagery.',
      },
      {
        assetRef: 'img-duck',
        chapterTitle: {
          vi: 'Chương 2: Người hàng xóm gầy gò tốt bụng',
          en: 'Chapter 2: The Quiet Neighbor Next Door',
        },
        vi: 'Cách hang tôi vài bước chân có một bạn dế nhỏ gầy gò, đôi cánh ngắn ngủn và tính tình vô cùng rụt rè. Ban đầu vì còn trẻ người non dạ, tôi hay chê hang của bạn sơ sài và cười đùa mỗi khi bạn bước đi chậm rãi.\n\nThế nhưng một buổi chiều mưa dông bất ngờ trút nước ngập trắng bãi cỏ, chính người bạn nhỏ ấy đã nhanh trí chỉ cho tôi lối thoát lên gò đất cao. Từ giây phút đó, tôi nhận ra sức mạnh thật sự không nằm ở vẻ ngoài oai vệ mà ở tấm lòng biết quan tâm tới người khác.',
        en: 'Just a few blades of grass away lived a slim, quiet neighbor with short wings and a shy manner. In my youthful pride, I used to tease him for digging a modest burrow and walking slowly along the dirt path.\n\nYet when a sudden summer thunderstorm flooded the low meadow, it was that quiet neighbor who guided me to high ground above the rushing water. In that moment, I realized true strength has little to do with boasting and everything to do with a caring heart.',
        noteVi: 'Bài học đầu tiên về sự khiêm tốn và trân trọng bạn bè xung quanh.',
        noteEn: 'A gentle turning point about humility and valuing quiet friends.',
      },
      {
        assetRef: 'img-cat',
        chapterTitle: {
          vi: 'Chương 3: Lên đường qua con suối bạc',
          en: 'Chapter 3: Crossing the Silver Brook',
        },
        vi: 'Sau cơn mưa đầu mùa, bầu trời trong vắt như rửa. Tôi quyết định xếp gọn hành trang là mấy giọt mật hoa ngọt lành rồi từ biệt triền đê để bước vào chuyến phiêu lưu đầu tiên của đời mình.\n\nChướng ngại đầu tiên là con suối nhỏ trong vắt chảy róc rách. Nhờ một chiếc lá sen khô trôi sát bờ và sự chỉ dẫn của bác chuồn chuồn kim áo xanh biếc, tôi chèo chiếc thuyền lá xanh vượt qua dòng nước mát lành, lòng ngập tràn cảm giác hồi hộp trước chân trời mới.',
        en: 'After the storm cleared, the sky shone spotless blue. Packing a tiny bundle of sweet clover nectar, I bid farewell to the familiar embankment and set off on my very first real journey.\n\nMy first test was a sparkling brook bubbling over smooth pebbles. Guided by a sapphire damselfly gliding overhead, I hopped aboard a curled willow leaf and paddled across the cool current, my heart racing at the sight of unfamiliar hills ahead.',
        noteVi: 'Hình ảnh chiếc thuyền lá vượt suối khơi gợi trí tưởng tượng phong phú cho trẻ.',
        noteEn: 'Sailing on a willow leaf sparks vivid adventure imagery.',
      },
      {
        assetRef: 'img-dog',
        chapterTitle: {
          vi: 'Chương 4: Khu vườn hoa cúc và khúc hòa tấu đêm',
          en: 'Chapter 4: The Marigold Garden Concert',
        },
        vi: 'Bên kia suối là một khu vườn rực rỡ sắc vàng của hoa cúc và hương thơm thoang thoảng của lá bạc hà. Khi hoàng hôn buông xuống, cả khu vườn biến thành một sân khấu âm nhạc diệu kỳ.\n\nCác bạn ve sầu, châu chấu xanh, đom đóm cầm đèn lồng vàng nhấp nháy cùng nhau tấu lên bản giao hưởng mùa hè. Tôi được mời góp tiếng đàn cánh trầm ấm của mình vào bản nhạc chung — lần đầu tiên tôi hiểu niềm vui khi hòa giọng cùng tập thể thay vì chỉ khoe tài một mình.',
        en: 'Beyond the brook stretched a dazzling garden of golden marigolds and fragrant mint leaves. As twilight settled into indigo, the entire garden transformed into an open-air concert hall.\n\nCicadas, emerald grasshoppers, and fireflies carrying tiny glowing lanterns joined together in a summer symphony. Invited to add the warm rhythm of my wings to the chorus, I discovered for the first time how much richer music sounds when played together.',
        noteVi: 'Âm nhạc thiên nhiên dạy bài học về tinh thần hợp tác và sẻ chia.',
        noteEn: 'Nature’s evening symphony celebrates teamwork over solo pride.',
      },
      {
        assetRef: 'img-orange',
        chapterTitle: {
          vi: 'Chương 5: Giúp gia đình nhà kiến chuyển kho hạt',
          en: 'Chapter 5: Helping the Ant Colony Before the Rain',
        },
        vi: 'Sáng hôm sau, mây đen kéo tới từ phía chân trời. Trên con đường mòn đất đỏ, hàng trăm bạn kiến nhỏ đang hối hả chuyển những hạt lúa mì về tổ trước khi cơn mưa lớn đổ xuống, nhưng một cành cây khô chắn ngang lối đi khiến cả đoàn bị ùn tắc.\n\nKhông chần chừ, tôi gọi thêm anh bạn bọ cánh cứng khỏe khoắn ở gần đó cùng hợp sức đẩy cành cây sang một bên. Nhìn đoàn kiến nối đuôi nhau về tổ an toàn ngay trước khi hạt mưa đầu tiên rơi xuống, tôi thấy lòng mình nhẹ bẫng và vui sướng lạ thường.',
        en: 'The next morning, silver clouds rolled in from the horizon. Along the red-earth trail, hundreds of industrious ants hurried to carry wheat grains home before the downpour, only to be blocked by a fallen twig.\n\nWithout hesitating, I rallied a friendly rhinoceros beetle nearby, and together we heaved the branch aside. Watching the entire colony reach shelter moments before the first raindrops fell filled me with a quiet pride far deeper than any trophy.',
        noteVi: 'Hành động giúp đỡ kịp thời mang lại niềm vui chân thật.',
        noteEn: 'Lending a hand at the right moment brings lasting joy.',
      },
      {
        assetRef: 'img-story-fruit-market',
        chapterTitle: {
          vi: 'Chương 6: Trở về triền đê với những câu chuyện mới',
          en: 'Chapter 6: Returning Home with Stories to Share',
        },
        vi: 'Khi gió thu bắt đầu se lạnh, tôi men theo bờ cỏ xanh trở về triền đê quê cũ. Người bạn hàng xóm nhỏ bé ngày nào chạy ra đón tôi từ xa, ánh mắt ánh lên niềm vui mừng khôn xiết.\n\nĐêm ấy, dưới ánh trăng bạc dịu dàng, hai chúng tôi ngồi bên nhau nghe tiếng sương rơi và tôi kể cho bạn nghe về con suối bạc, đêm hòa nhạc hoa cúc cùng bài học quý giá nhất sau chuyến đi: thế giới thật rộng lớn, và mỗi người bạn ta gặp đều là một trang sách tuyệt đẹp.',
        en: 'As the crisp autumn breeze began to blow, I followed the winding riverbank back to my old meadow. My quiet neighbor spotted me from afar and hurried out to greet me with shining eyes.\n\nThat evening beneath a gentle silver moon, we sat side by side as I recounted the willow-leaf voyage, the firefly concert, and the truest lesson of my travels: the world is wonderfully wide, and every kind friend we meet is a story worth treasuring.',
        noteVi: 'Hết truyện — Chúc các bạn nhỏ luôn giữ tinh thần khám phá và trái tim ấm áp.',
        noteEn: 'End of audiobook — stay curious, humble, and kind on every adventure.',
      },
    ],
  },
  {
    externalId: 'alice-wonderland-long',
    category: 'classics',
    storyFormat: 'long_story',
    ageBands: ['9-11', '12-14', '15-18'],
    author: 'Lewis Carroll (Song ngữ Việt – Anh · 6 Chương)',
    coverAssetRef: 'img-orange',
    estimatedMinutes: 16,
    titles: {
      vi: 'Alice Ở Xứ Sở Thần Tiên — Bản Sách Nói 6 Chương',
      en: 'Alice in Wonderland — 6-Chapter Bilingual Audiobook',
    },
    summaries: {
      vi: 'Hành trình kỳ ảo theo chân cô bé Alice đuổi theo chú Thỏ Trắng cầm đồng hồ quả quýt qua hang thỏ xuống thế giới đầy những câu đố thú vị.',
      en: 'Follow curious Alice down the rabbit hole in this 6-chapter bilingual audiobook adaptation of Lewis Carroll’s timeless classic.',
    },
    segments: [
      {
        assetRef: 'img-story-sunny-farm',
        chapterTitle: {
          vi: 'Chương 1: Theo chân Thỏ Trắng xuống hang sâu',
          en: 'Chapter 1: Down the Rabbit-Hole',
        },
        vi: 'Một buổi chiều nắng vàng dịu nhẹ bên bờ sông, Alice đang ngồi cạnh chị gái đọc sách thì bỗng thấy một chú Thỏ Trắng mặc áo gi-lê chạy vụt qua. Điều lạ lùng nhất là chú thỏ rút từ trong túi ra một chiếc đồng hồ quả quýt, vừa nhìn vừa lẩm bẩm: "Ôi thôi, muộn mất rồi!"\n\nTính tò mò trỗi dậy, Alice bật dậy chạy theo băng qua bãi cỏ và bước xuống một cái hang thỏ sâu hun hút. Cô bé rơi chậm rãi như đang lơ lửng trong giấc mơ, xung quanh tường hang chất đầy kệ sách, bản đồ và những lọ mứt cam dán nhãn gọn gàng.',
        en: 'On a golden afternoon beside the riverbank, Alice was growing sleepy next to her sister when a White Rabbit in a neat waistcoat dashed right past her. Even more astonishing, the rabbit pulled a pocket watch from his vest and muttered, "Oh dear! I shall be too late!"\n\nSparked by curiosity, Alice sprang to her feet, raced across the clover field, and popped straight down a deep rabbit-hole. She floated downward as gently as a feather, passing walls lined with bookshelves, maps, and neatly labeled jars of orange marmalade.',
        noteVi: 'Mở đầu kinh điển khơi dậy trí tưởng tượng và niềm yêu thích đọc sách.',
        noteEn: 'The famous opening celebrating curiosity and imagination.',
      },
      {
        assetRef: 'img-story-fruit-market',
        chapterTitle: {
          vi: 'Chương 2: Cánh cửa nhỏ và chiếc chìa khóa vàng',
          en: 'Chapter 2: The Golden Key and Tiny Door',
        },
        vi: 'Khi chạm chân xuống nền sảnh dài thắp sáng bằng hàng đèn treo lung linh, Alice nhìn thấy một chiếc bàn kính ba chân đặt đúng một chiếc chìa khóa vàng bé xíu. Sau tấm rèm nhung, cô phát hiện một cánh cửa nhỏ chỉ cao bằng gang tay mở ra khu vườn hoa hồng đẹp tuyệt trần.\n\nLàm sao để bước qua cánh cửa bé tí ấy? Alice nhìn lên bàn kính thì thấy một chiếc lọ pha lê buộc dải ruy-băng ghi dòng chữ "Hãy uống tôi". Vị ngọt thanh như bánh anh đào hòa lẫn dứa nướng giúp cô thu nhỏ lại vừa vặn như một cô búp bê thông minh.',
        en: 'Landing softly inside a long hall lit by glowing hanging lamps, Alice spotted a three-legged glass table holding a single tiny golden key. Behind a velvet curtain stood a miniature doorway opening onto the loveliest rose garden she had ever imagined.\n\nWondering how she might pass through, Alice discovered a crystal bottle tied with a neat ribbon reading "DRINK ME." Tasting faintly of cherry tart and warm pineapple, a small sip shrank her down to the exact height of the little garden door.',
        noteVi: 'Từ vựng thú vị: pocket watch, velvet curtain, crystal bottle.',
        noteEn: 'Rich descriptive vocabulary for intermediate readers.',
      },
      {
        assetRef: 'img-cat',
        chapterTitle: {
          vi: 'Chương 3: Chú Mèo Cheshire biết cười',
          en: 'Chapter 3: The Grinning Cheshire Cat',
        },
        vi: 'Bước vào khu rừng cổ tích rợp bóng cây, Alice gặp một chú Mèo Cheshire nằm vắt vẻo trên cành sồi cao, nở nụ cười rộng thật thân thiện. Alice lễ phép hỏi: "Xin cho cháu hỏi, từ đây cháu nên đi theo con đường nào ạ?"\n\nChú mèo chớp đôi mắt xanh biếc đáp lại bằng một câu nói rất đáng suy ngẫm: "Điều đó còn tùy vào việc cháu muốn đi tới đâu đã." Rồi chú mèo từ từ tan biến vào không trung, chỉ để lại nụ cười lơ lửng giữa tán lá nắng chiều.',
        en: 'Wandering into a sunlit woodland, Alice met the Cheshire Cat lounging comfortably on an oak branch with an impossibly wide, cheerful grin. Politely, Alice asked, "Would you tell me, please, which way I ought to go from here?"\n\n"That depends a good deal on where you want to get to," the cat replied thoughtfully. With a gentle purr, the cat faded slowly from tail to ears until nothing remained among the leaves except its friendly smile.',
        noteVi: 'Câu thoại nổi tiếng về việc xác định mục tiêu rõ ràng trước khi lựa chọn con đường.',
        noteEn: 'One of literature’s most famous dialogues on purpose and direction.',
      },
      {
        assetRef: 'img-orange',
        chapterTitle: {
          vi: 'Chương 4: Tiệc trà kỳ lạ của Bác Thợ Làm Mũ',
          en: 'Chapter 4: A Most Unusual Tea Party',
        },
        vi: 'Đi thêm một đoạn, Alice bắt gặp chiếc bàn dài bày đầy ấm trà sứ và tách hoa đặt dưới gốc cây lớn. Bác Thợ Làm Mũ, Thỏ Tháng Ba và chú Chuột Sóc đang ngồi uống trà và đố nhau những câu đố hóm hỉnh không có đáp án cố định.\n\nHọ hào hứng kể cho Alice nghe rằng chiếc đồng hồ của họ luôn dừng ở đúng 6 giờ chiều — giờ thưởng trà và trò chuyện. Alice vừa nhâm nhi tách trà ấm vừa học cách lắng nghe những góc nhìn thật sáng tạo và hài hước.',
        en: 'A short stroll later, Alice came upon a long table laid with porcelain teapots beneath a shady tree. The Mad Hatter, the March Hare, and a sleepy Dormouse sat trading playful riddles that twisted ordinary logic upside down.\n\nThey cheerfully explained that their clock always stayed at six o’clock—forever tea-time and storytelling time. Sipping warm tea, Alice marveled at how wordplay and laughter could turn an ordinary afternoon into an adventure.',
        noteVi: 'Trò chơi chữ (wordplay) và câu đố là nét duyên đặc trưng của Lewis Carroll.',
        noteEn: 'Playful riddles and wordplay are Lewis Carroll’s signature charm.',
      },
      {
        assetRef: 'img-duck',
        chapterTitle: {
          vi: 'Chương 5: Khu vườn hoa hồng và trò chơi kỳ thú',
          en: 'Chapter 5: The Rose Garden Courtyard',
        },
        vi: 'Cuối cùng Alice cũng bước được qua cánh cổng dẫn tới khu vườn hoa hồng rực rỡ sắc màu, nơi những đài phun nước mát lạnh tung bọt trắng xóa giữa hàng cây xanh cắt tỉa gọn gàng.\n\nTại đây, cô bé giữ được sự bình tĩnh và tự tin lạ thường trước đủ mọi tình huống bất ngờ, mạnh dạn nói lên suy nghĩ công bằng của mình. Alice nhận ra rằng khi ta không còn sợ hãi trước những điều lạ lẫm, ta sẽ luôn tìm ra cách giải quyết sáng suốt.',
        en: 'At last Alice stepped into the grand rose garden she had glimpsed through the tiny door, filled with cool marble fountains and neatly trimmed hedges.\n\nSurrounded by bustling courtiers and whimsical games, Alice stayed remarkably calm and fair-minded, speaking up kindly whenever things grew confusing. She realized that curiosity paired with quiet courage makes even the strangest place feel navigable.',
        noteVi: 'Alice trưởng thành hơn nhờ sự bình tĩnh, lễ phép và công bằng.',
        noteEn: 'Alice grows through calmness, politeness, and fairness.',
      },
      {
        assetRef: 'img-apple',
        chapterTitle: {
          vi: 'Chương 6: Tỉnh giấc bên dòng sông mùa hạ',
          en: 'Chapter 6: Awakening by the Summer River',
        },
        vi: 'Một cơn gió nhẹ thổi qua làm những chiếc lá vàng xoay tròn trong không trung — và Alice khẽ mở mắt ra, thấy mình vẫn đang gối đầu trên bãi cỏ mềm bên bờ sông cùng chị gái.\n\n"Chị ơi, em vừa có một giấc mơ kỳ diệu lắm!" Alice reo lên rồi say sưa kể lại từng chương về Thỏ Trắng, Mèo Cheshire và bữa tiệc trà chiều. Chị gái mỉm cười lắng nghe, biết rằng trí tưởng tượng trong sáng ấy sẽ còn đồng hành cùng Alice trên nhiều chặng đường khôn lớn.',
        en: 'A gentle breeze sent golden leaves fluttering upward like a deck of cards—and Alice blinked awake on the soft riverbank grass beside her sister.\n\n"Oh, I have had such a curious dream!" Alice exclaimed, eagerly recounting every chapter from the White Rabbit to the Cheshire Cat. Her sister smiled warmly, knowing that a bright, wondering imagination is a gift to carry for a lifetime.',
        noteVi: 'Hết sách nói — Bé có thể chuyển ngôn ngữ giữa Tiếng Việt và English ngay trong thanh điều khiển!',
        noteEn: 'End of audiobook — switch freely between English and Vietnamese narration anytime!',
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
    learningPackageId: blueprint.storyFormat === 'long_story' ? '' : 'lp-fruits-a1',
    ageBands: blueprint.ageBands,
    coverAssetRef: blueprint.coverAssetRef,
    availableLocales: ['vi', 'en'],
    availableExplanationLocales: ['vi', 'en'],
    titles: {
      vi: blueprint.titles.vi,
      en: blueprint.titles.en,
    },
    summaries: {
      vi: blueprint.summaries.vi,
      en: blueprint.summaries.en,
    },
    storyFormat: blueprint.storyFormat ?? 'picture_book',
    chapterCount: blueprint.segments.length,
    totalDurationSec: blueprint.estimatedMinutes * 60,
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
      chapterTitle: seg.chapterTitle
        ? `${seg.chapterTitle.vi} · ${seg.chapterTitle.en}`
        : undefined,
      textByLocale: {
        vi: seg.vi,
        en: seg.en,
      },
      explanationByLocale: {
        vi: seg.noteVi,
        en: seg.noteEn,
      },
    })),
  };
}
