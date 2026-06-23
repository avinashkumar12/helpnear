import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...');

  // ── Categories ──────────────────────────────────────────────────────────────
  const categories = [
    { name: 'Plumber',      icon: '🔧' },
    { name: 'Electrician',  icon: '⚡' },
    { name: 'Maid',         icon: '🧹' },
    { name: 'Carpenter',    icon: '🪚' },
    { name: 'Mechanic',     icon: '🔩' },
    { name: 'AC Repair',    icon: '❄️' },
    { name: 'Painter',      icon: '🎨' },
    { name: 'Gardener',     icon: '🌿' },
    { name: 'Cook',         icon: '👨‍🍳' },
    { name: 'Driver',       icon: '🚗' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon },
      create: cat,
    });
  }
  console.log('✅ Categories seeded (10)');

  // ── Admin Account ───────────────────────────────────────────────────────────
  const adminEmail = 'admin@helpernear.com';
  const adminPassword = 'Admin@123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'ADMIN', name: 'Super Admin' },
    create: {
      name: 'Super Admin',
      email: adminEmail,
      phone: '+910000000000',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin account');

  // ── Customer Users ──────────────────────────────────────────────────────────
  const customers = [
    { name: 'Rahul Sharma',  phone: '+911111111111', email: 'rahul@example.com' },
    { name: 'Priya Singh',   phone: '+912222222222', email: 'priya@example.com' },
    { name: 'Amit Kumar',    phone: '+913333333333', email: 'amit@example.com' },
    { name: 'Neha Gupta',    phone: '+914444444444', email: 'neha@example.com' },
    { name: 'Sanjay Verma',  phone: '+915555555555', email: 'sanjay@example.com' },
  ];

  const customerRecs: any[] = [];
  for (const u of customers) {
    const rec = await prisma.user.upsert({
      where: { phone: u.phone },
      update: { name: u.name },
      create: { ...u, role: 'CUSTOMER' },
    });
    customerRecs.push(rec);
  }
  console.log('✅ Customer users (5)');

  // ── Worker Users + Profiles ─────────────────────────────────────────────────
  const allCats = await prisma.category.findMany();
  const catMap = Object.fromEntries(allCats.map(c => [c.name, c.id]));

  const demoWorkers = [
    {
      phone: '+919811111111', name: 'Raju Plumber',
      bio: 'Expert in pipe fitting, bathroom repairs, drainage and water tank cleaning. 10+ years experience across Delhi NCR.',
      experienceYears: 10, priceRange: '₹300–600/hr',
      lat: 28.6139, lng: 77.2090, status: 'AVAILABLE' as const,
      cats: ['Plumber'],
    },
    {
      phone: '+919822222222', name: 'Suresh Kumar',
      bio: 'Certified electrician. Wiring, switchboard repair, inverter installation, short-circuit troubleshooting.',
      experienceYears: 8, priceRange: '₹400–700/hr',
      lat: 28.6200, lng: 77.2150, status: 'AVAILABLE' as const,
      cats: ['Electrician'],
    },
    {
      phone: '+919833333333', name: 'Sunita Devi',
      bio: 'Professional house cleaning, cooking and babysitting. Reliable and trusted by 200+ families in Delhi.',
      experienceYears: 5, priceRange: '₹200–400/hr',
      lat: 28.6100, lng: 77.2050, status: 'BUSY' as const,
      cats: ['Maid', 'Cook'],
    },
    {
      phone: '+919844444444', name: 'Mohan Carpenter',
      bio: 'Custom furniture making, door/window repairs, modular kitchen assembly and all types of woodwork.',
      experienceYears: 12, priceRange: '₹500–900/hr',
      lat: 28.6250, lng: 77.2100, status: 'AVAILABLE' as const,
      cats: ['Carpenter'],
    },
    {
      phone: '+919855555555', name: 'Vikram AC Tech',
      bio: 'AC installation, servicing, gas refilling and PCB repair for all brands – Daikin, Voltas, LG, Samsung.',
      experienceYears: 7, priceRange: '₹350–650/hr',
      lat: 28.6080, lng: 77.2200, status: 'AVAILABLE' as const,
      cats: ['AC Repair'],
    },
    {
      phone: '+919866666666', name: 'Deepak Painter',
      bio: 'Interior and exterior wall painting, texture work and waterproofing with quality materials.',
      experienceYears: 6, priceRange: '₹250–500/hr',
      lat: 28.6300, lng: 77.2000, status: 'OFFLINE' as const,
      cats: ['Painter'],
    },
    {
      phone: '+919877777777', name: 'Ramesh Mechanic',
      bio: 'Two-wheeler and four-wheeler mechanic. Engine overhaul, servicing and breakdown assistance.',
      experienceYears: 9, priceRange: '₹400–800/hr',
      lat: 28.6150, lng: 77.2300, status: 'AVAILABLE' as const,
      cats: ['Mechanic'],
    },
    {
      phone: '+919888888888', name: 'Lata Gardener',
      bio: 'Garden maintenance, plant care, landscaping and balcony garden setup. Passionate about plants.',
      experienceYears: 4, priceRange: '₹200–350/hr',
      lat: 28.6050, lng: 77.1950, status: 'AVAILABLE' as const,
      cats: ['Gardener'],
    },
  ];

  const workerProfiles: any[] = [];
  for (const w of demoWorkers) {
    const user = await prisma.user.upsert({
      where: { phone: w.phone },
      update: { name: w.name, role: 'WORKER' },
      create: { name: w.name, phone: w.phone, role: 'WORKER' },
    });

    const profile = await prisma.workerProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: w.bio, experienceYears: w.experienceYears, priceRange: w.priceRange,
        latitude: w.lat, longitude: w.lng, isVerified: true, status: w.status,
      },
      create: {
        userId: user.id, bio: w.bio, experienceYears: w.experienceYears,
        priceRange: w.priceRange, latitude: w.lat, longitude: w.lng,
        isVerified: true, status: w.status,
      },
    });

    for (const catName of w.cats) {
      const catId = catMap[catName];
      if (catId) {
        await prisma.workerCategory.upsert({
          where: { workerId_categoryId: { workerId: profile.id, categoryId: catId } },
          update: {},
          create: { workerId: profile.id, categoryId: catId },
        });
      }
    }
    workerProfiles.push(profile);
  }
  console.log('✅ Worker profiles (8 verified, near Delhi)');

  // ── Reviews ─────────────────────────────────────────────────────────────────
  const reviewData = [
    { workerIdx: 0, userIdx: 0, rating: 5, comment: 'Raju fixed our bathroom pipe in under an hour. Very professional and clean work!' },
    { workerIdx: 0, userIdx: 1, rating: 4, comment: 'Good work, came on time. Will hire again.' },
    { workerIdx: 0, userIdx: 2, rating: 5, comment: 'Excellent service! Found and fixed a hidden leak that other plumbers missed.' },
    { workerIdx: 1, userIdx: 0, rating: 5, comment: 'Suresh installed our new switchboard perfectly. Very knowledgeable!' },
    { workerIdx: 1, userIdx: 3, rating: 4, comment: 'Fixed wiring issue quickly. Reasonable rates.' },
    { workerIdx: 2, userIdx: 1, rating: 5, comment: 'Sunita is amazing! House was spotless after she was done.' },
    { workerIdx: 2, userIdx: 2, rating: 5, comment: 'She cooked the most delicious dal and sabzi. Highly recommended!' },
    { workerIdx: 2, userIdx: 4, rating: 4, comment: 'Reliable and honest. Has been coming regularly for 3 months.' },
    { workerIdx: 3, userIdx: 0, rating: 5, comment: 'Mohan built a beautiful wardrobe for us. Quality craftsmanship!' },
    { workerIdx: 3, userIdx: 3, rating: 5, comment: 'Repaired our wooden door perfectly. Very skilled.' },
    { workerIdx: 4, userIdx: 1, rating: 5, comment: 'AC is working like new after Vikram serviced it. Great job!' },
    { workerIdx: 4, userIdx: 4, rating: 4, comment: 'Fast service, came the same day I called.' },
    { workerIdx: 5, userIdx: 2, rating: 4, comment: 'Good painting work. Clean finish on walls.' },
    { workerIdx: 6, userIdx: 0, rating: 5, comment: 'Ramesh saved us during a breakdown on the highway. Very helpful.' },
    { workerIdx: 6, userIdx: 1, rating: 5, comment: 'Regular servicing of our car. Always on time and thorough.' },
    { workerIdx: 7, userIdx: 3, rating: 5, comment: 'Lata transformed our terrace garden completely. Beautiful work!' },
    { workerIdx: 7, userIdx: 4, rating: 4, comment: 'Takes great care of our plants. Very knowledgeable.' },
  ];

  for (const r of reviewData) {
    const worker = workerProfiles[r.workerIdx];
    const user = customerRecs[r.userIdx];
    if (!worker || !user) continue;
    // Check if review already exists to avoid duplicates
    const existing = await prisma.review.findFirst({
      where: { workerId: worker.id, userId: user.id },
    });
    if (!existing) {
      await prisma.review.create({
        data: { workerId: worker.id, userId: user.id, rating: r.rating, comment: r.comment },
      });
    }
  }
  console.log('✅ Reviews (17)');

  // ── Complaints ──────────────────────────────────────────────────────────────
  const complaintData = [
    { reporterIdx: 0, workerIdx: 5, reason: 'Worker arrived 2 hours late without any notification.', status: 'REVIEWED' as const, adminNote: 'Worker has been warned.' },
    { reporterIdx: 2, workerIdx: 6, reason: 'Charged extra amount not discussed beforehand.', status: 'PENDING' as const },
    { reporterIdx: 4, workerIdx: 1, reason: 'Work quality was poor, had to redo the switchboard.', status: 'RESOLVED' as const, adminNote: 'Refund issued to customer.' },
  ];

  for (const c of complaintData) {
    const reporter = customerRecs[c.reporterIdx];
    const worker = workerProfiles[c.workerIdx];
    if (!reporter || !worker) continue;
    const existing = await prisma.complaint.findFirst({
      where: { reporterId: reporter.id, workerId: worker.id },
    });
    if (!existing) {
      await prisma.complaint.create({
        data: {
          reporterId: reporter.id,
          workerId: worker.id,
          reason: c.reason,
          status: c.status,
          adminNote: c.adminNote,
          resolvedAt: c.status === 'RESOLVED' ? new Date() : null,
        },
      });
    }
  }
  console.log('✅ Complaints (3)');

  // ── Contact Logs ─────────────────────────────────────────────────────────────
  const clData = [
    { workerIdx: 0, userIdx: 0, channel: 'call' },
    { workerIdx: 0, userIdx: 1, channel: 'whatsapp' },
    { workerIdx: 1, userIdx: 2, channel: 'call' },
    { workerIdx: 2, userIdx: 0, channel: 'call' },
    { workerIdx: 2, userIdx: 3, channel: 'whatsapp' },
    { workerIdx: 4, userIdx: 4, channel: 'call' },
    { workerIdx: 6, userIdx: 1, channel: 'whatsapp' },
  ];

  for (const cl of clData) {
    const worker = workerProfiles[cl.workerIdx];
    const user = customerRecs[cl.userIdx];
    if (!worker || !user) continue;
    await prisma.contactLog.create({
      data: { workerId: worker.id, userId: user.id, channel: cl.channel },
    });
  }
  console.log('✅ Contact logs (7)');

  // ── Banners ──────────────────────────────────────────────────────────────────
  const banners = [
    {
      title: 'Find Trusted Workers Near You',
      subtitle: 'Plumbers, electricians, maids and more — all verified and ready to help.',
      imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80',
      linkUrl: '/app/',
      sortOrder: 1,
    },
    {
      title: '₹100 Off Your First Booking',
      subtitle: 'Use code FIRST100 to get ₹100 discount on your first service booking.',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80',
      linkUrl: '/app/',
      sortOrder: 2,
    },
    {
      title: 'Are You a Skilled Worker?',
      subtitle: 'Join HelperNear and get connected with thousands of customers in your area.',
      imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80',
      linkUrl: '/app/register.html',
      sortOrder: 3,
    },
  ];

  for (const b of banners) {
    const existing = await prisma.banner.findFirst({ where: { title: b.title } });
    if (!existing) {
      await prisma.banner.create({ data: b });
    }
  }
  console.log('✅ Banners (3)');

  // ── Testimonials ─────────────────────────────────────────────────────────────
  const testimonials = [
    {
      name: 'Anjali Mehta', role: 'Homemaker, Delhi',
      quote: 'HelperNear made finding a reliable plumber so easy! Raju came within an hour and fixed everything perfectly.',
      rating: 5, sortOrder: 1,
      translations: { hi: { name: 'अंजलि मेहता', role: 'गृहिणी, दिल्ली', quote: 'HelperNear ने एक विश्वसनीय प्लंबर खोजना बहुत आसान बना दिया!' } },
    },
    {
      name: 'Rajesh Kapoor', role: 'Software Engineer, Noida',
      quote: 'I was sceptical at first but the verified badge gives real confidence. Suresh did a great job with our wiring.',
      rating: 5, sortOrder: 2,
      translations: { hi: { name: 'राजेश कपूर', role: 'सॉफ्टवेयर इंजीनियर, नोएडा', quote: 'सुरेश ने हमारी वायरिंग का शानदार काम किया।' } },
    },
    {
      name: 'Pooja Agarwal', role: 'Working Professional, Gurgaon',
      quote: 'Sunita has been coming for 3 months now. She is trustworthy, thorough and my home has never been cleaner!',
      rating: 5, sortOrder: 3,
      translations: { hi: { name: 'पूजा अग्रवाल', role: 'वर्किंग प्रोफेशनल, गुड़गांव', quote: 'सुनीता 3 महीने से आ रही हैं, बहुत भरोसेमंद और मेहनती हैं।' } },
    },
    {
      name: 'Vikash Tiwari', role: 'Business Owner, Faridabad',
      quote: 'Hired Mohan to build a reception desk for my shop. The quality of work was outstanding and prices were fair.',
      rating: 5, sortOrder: 4,
      translations: {},
    },
  ];

  for (const t of testimonials) {
    const existing = await prisma.testimonial.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.testimonial.create({ data: t });
    }
  }
  console.log('✅ Testimonials (4)');

  // ── FAQs ─────────────────────────────────────────────────────────────────────
  const faqs = [
    {
      question: 'How do I find a worker near me?',
      answer: 'Open the HelperNear app, allow location access, and you will see verified workers available near your area. You can filter by category, rating and availability.',
      sortOrder: 1,
      translations: { hi: { question: 'मैं अपने पास एक कार्यकर्ता कैसे ढूंढूं?', answer: 'HelperNear ऐप खोलें, लोकेशन अनुमति दें और आपको अपने क्षेत्र में उपलब्ध सत्यापित कार्यकर्ता दिखेंगे।' } },
    },
    {
      question: 'Are all workers verified?',
      answer: 'Yes! Every worker on HelperNear goes through a manual verification process by our admin team. We check their identity, skills and background before granting the verified badge.',
      sortOrder: 2,
      translations: { hi: { question: 'क्या सभी कार्यकर्ता सत्यापित हैं?', answer: 'हाँ! HelperNear पर हर कार्यकर्ता हमारी एडमिन टीम द्वारा मैन्युअल सत्यापन प्रक्रिया से गुजरता है।' } },
    },
    {
      question: 'How do I contact a worker?',
      answer: 'Tap "Call" or "WhatsApp" on any worker card to contact them directly. You can also view their full profile to check reviews and experience before reaching out.',
      sortOrder: 3,
      translations: {},
    },
    {
      question: 'Is HelperNear free to use?',
      answer: 'Yes, HelperNear is completely free for customers. Workers pay a small subscription fee to be listed on the platform. There are no hidden charges.',
      sortOrder: 4,
      translations: { hi: { question: 'क्या HelperNear उपयोग करने के लिए मुफ्त है?', answer: 'हाँ, HelperNear ग्राहकों के लिए पूरी तरह मुफ्त है।' } },
    },
    {
      question: 'How can I become a worker on HelperNear?',
      answer: 'Click "Register as Worker" in the app, fill in your details and skills, upload your photo, and submit. Our team will review and verify your profile within 24 hours.',
      sortOrder: 5,
      translations: {},
    },
    {
      question: 'What if I have a complaint about a worker?',
      answer: 'Go to the worker\'s profile and tap "Report". Our admin team reviews all complaints within 48 hours and takes appropriate action including suspension if necessary.',
      sortOrder: 6,
      translations: {},
    },
  ];

  for (const f of faqs) {
    const existing = await prisma.faq.findFirst({ where: { question: f.question } });
    if (!existing) {
      await prisma.faq.create({ data: f });
    }
  }
  console.log('✅ FAQs (6)');

  // ── Announcements ─────────────────────────────────────────────────────────────
  const announcements = [
    {
      title: 'Welcome to HelperNear!',
      message: 'We are excited to launch in Delhi NCR. Find trusted workers for all home services at your fingertips.',
      type: 'INFO', targetAudience: 'ALL',
      translations: { hi: { title: 'HelperNear में आपका स्वागत है!', message: 'हम दिल्ली NCR में लॉन्च करते हुए खुश हैं।' } },
    },
    {
      title: 'Festive Season Offer',
      message: 'Get ₹100 off on your first booking this festive season. Use code FESTIVE100 at checkout.',
      type: 'PROMO', targetAudience: 'CUSTOMERS',
      translations: {},
    },
    {
      title: 'New Categories Added',
      message: 'We have added Cook and Driver categories. More skilled workers join every day!',
      type: 'INFO', targetAudience: 'ALL',
      translations: {},
    },
  ];

  for (const a of announcements) {
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (!existing) {
      await prisma.announcement.create({ data: a });
    }
  }
  console.log('✅ Announcements (3)');

  // ── Coupons ──────────────────────────────────────────────────────────────────
  const coupons = [
    { code: 'FIRST100', description: '₹100 off on first booking', discountType: 'FLAT', discountValue: 100, maxUses: 500 },
    { code: 'FESTIVE100', description: 'Festive season discount', discountType: 'FLAT', discountValue: 100, maxUses: 200, expiresAt: new Date('2026-12-31') },
    { code: 'SAVE20', description: '20% off on any service', discountType: 'PERCENTAGE', discountValue: 20, maxUses: 300 },
    { code: 'NEWUSER50', description: '₹50 off for new users', discountType: 'FLAT', discountValue: 50 },
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log('✅ Coupons (4)');

  // ── Blog Posts ────────────────────────────────────────────────────────────────
  const blogPosts = [
    {
      slug: 'how-to-find-reliable-plumber',
      title: 'How to Find a Reliable Plumber in Your City',
      excerpt: 'Finding a trustworthy plumber can be stressful. Here are 5 tips to ensure you hire the right professional for your home.',
      content: `<h2>1. Always Check Verified Badges</h2><p>When using any home services platform, always look for workers with a verified badge. This indicates their identity and skills have been checked by the platform team.</p><h2>2. Read Reviews Carefully</h2><p>Don't just look at the star rating — read the actual comments. Pay attention to reviews that mention punctuality, cleanliness and quality of work.</p><h2>3. Get a Quote Before Work Starts</h2><p>Always ask for an estimate before the plumber begins working. A transparent professional will gladly provide this without pressure.</p><h2>4. Check Experience Years</h2><p>For complex jobs like pipe replacement or bathroom overhaul, prefer someone with 5+ years of experience.</p><h2>5. Prefer Local Workers</h2><p>Local workers care about their reputation in the community. Apps like HelperNear show you nearby verified plumbers with real reviews from your neighbours.</p>`,
      author: 'HelperNear Team',
      isPublished: true,
      publishedAt: new Date('2026-06-01'),
      coverImage: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80',
      translations: { hi: { title: 'अपने शहर में एक विश्वसनीय प्लंबर कैसे खोजें', excerpt: 'एक भरोसेमंद प्लंबर खोजना तनावपूर्ण हो सकता है। यहाँ 5 सुझाव दिए गए हैं।' } },
    },
    {
      slug: 'home-electrical-safety-tips',
      title: '10 Home Electrical Safety Tips Every Homeowner Must Know',
      excerpt: 'Electrical accidents are one of the leading causes of home fires. Learn these 10 safety habits to keep your family safe.',
      content: `<h2>Why Electrical Safety Matters</h2><p>Each year thousands of house fires in India are caused by faulty wiring or electrical misuse. These accidents are almost entirely preventable.</p><h2>Top 10 Tips</h2><ol><li><strong>Never overload power strips</strong> — each strip has a maximum wattage limit.</li><li><strong>Replace frayed wires immediately</strong> — exposed copper is a fire hazard.</li><li><strong>Use ISI marked products</strong> — cheap imitations can fail dangerously.</li><li><strong>Install MCB (Miniature Circuit Breakers)</strong> — they trip before wires overheat.</li><li><strong>Keep water away from electrical outlets</strong> — especially in kitchens and bathrooms.</li><li><strong>Do not DIY complex electrical work</strong> — always hire a certified electrician.</li><li><strong>Check your earthing annually</strong> — faulty earthing causes electric shocks.</li><li><strong>Unplug appliances when not in use</strong> — this also saves electricity.</li><li><strong>Teach children about electrical safety</strong> — cover unused sockets.</li><li><strong>Get a professional inspection every 5 years</strong> — wiring degrades over time.</li></ol><p>Find a certified electrician near you on HelperNear today.</p>`,
      author: 'Suresh Kumar, Electrician',
      isPublished: true,
      publishedAt: new Date('2026-06-10'),
      coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      translations: {},
    },
    {
      slug: 'monsoon-home-maintenance-checklist',
      title: 'Monsoon Home Maintenance Checklist: 8 Things to Do Before the Rains',
      excerpt: 'The monsoon season can wreak havoc on an unprepared home. Use this checklist to monsoon-proof your house before the rains arrive.',
      content: `<p>With monsoon just around the corner, now is the perfect time to inspect your home for vulnerabilities. Here is your complete checklist:</p><h2>Roof and Walls</h2><ul><li>Check for cracks in walls and apply waterproofing paint.</li><li>Inspect roof for loose tiles or damaged waterproofing membrane.</li><li>Clean all gutters and drainage pipes to prevent clogging.</li></ul><h2>Plumbing</h2><ul><li>Inspect all pipes for leaks — even small ones get worse in the monsoon.</li><li>Check bathroom drains for blockages.</li><li>Ensure your water tank cover is secure to prevent contamination.</li></ul><h2>Electrical</h2><ul><li>Check outdoor electrical connections for exposed wiring.</li><li>Ensure all switches and outlets near water sources are waterproofed.</li><li>Test your MCBs and RCCBs.</li></ul><h2>General</h2><ul><li>Trim trees near your home — heavy branches can fall during storms.</li><li>Stock up on mosquito repellents and check for standing water.</li></ul><p>Need help with any of these? Book a verified worker on HelperNear — plumbers, electricians and painters are available near you.</p>`,
      author: 'HelperNear Team',
      isPublished: true,
      publishedAt: new Date('2026-06-15'),
      coverImage: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=80',
      translations: {},
    },
    {
      slug: 'why-hire-verified-workers',
      title: 'Why You Should Always Hire Verified Workers for Home Services',
      excerpt: 'The internet is full of unverified "professionals." Here is why choosing a verified worker protects you, your home, and your wallet.',
      content: `<p>We all have heard horror stories — the plumber who made the leak worse, the electrician who caused a short circuit, the painter who disappeared after taking an advance. These experiences are unfortunately common when you hire through unverified channels.</p><h2>What Does "Verified" Actually Mean?</h2><p>At HelperNear, verification is not just a checkbox. It involves:</p><ul><li>Identity proof verification (Aadhaar / government ID)</li><li>Skills assessment or proof of experience</li><li>Background check for any criminal history</li><li>Regular review monitoring — workers with consistently poor reviews lose their verified status</li></ul><h2>The Real Cost of Hiring Unverified Workers</h2><p>A cheap but unqualified worker can cost you 5x more in repairs. A safety risk in your home can cost you much more. Your peace of mind is priceless.</p><h2>Always Check These Before Hiring</h2><ol><li>Verified badge</li><li>Minimum 4-star rating with 5+ reviews</li><li>Experience years relevant to your job</li><li>Clear pricing before work starts</li></ol>`,
      author: 'HelperNear Team',
      isPublished: true,
      publishedAt: new Date('2026-06-20'),
      coverImage: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80',
      translations: {},
    },
    {
      slug: 'ac-maintenance-tips-summer',
      title: 'Keep Your AC Running Smoothly This Summer: 6 Maintenance Tips',
      excerpt: 'An unmaintained AC can increase your electricity bill by 30% and break down in peak summer. Here are 6 tips from our experts.',
      content: `<h2>Why Regular AC Maintenance is Essential</h2><p>Your air conditioner works hardest in summer. Without proper maintenance, it can lose up to 5% efficiency per year. That means higher bills, more breakdowns, and a shorter lifespan.</p><h2>6 Tips from Our Experts</h2><h3>1. Clean the Filter Every Month</h3><p>A clogged filter restricts airflow and makes the compressor work harder. Remove and rinse the filter with water monthly.</p><h3>2. Clear the Outdoor Unit</h3><p>Make sure the outdoor condenser unit is free of leaves, dirt and obstructions. Good airflow is critical for cooling efficiency.</p><h3>3. Check for Gas Leaks Annually</h3><p>Low refrigerant is a common cause of poor cooling. Get your gas pressure checked by a certified technician every year.</p><h3>4. Service Before Peak Summer</h3><p>Book your annual service in March–April, before temperatures peak. Prices are lower and technicians are more available.</p><h3>5. Don't Set Temperature Too Low</h3><p>Setting your AC to 24°C instead of 18°C can save up to 20% electricity. The BEE recommends 24°C as the optimal temperature.</p><h3>6. Check the Drainage Pipe</h3><p>A blocked drainage pipe causes water leakage inside your room. Clean it at the beginning of each summer.</p>`,
      author: 'Vikram AC Tech',
      isPublished: true,
      publishedAt: new Date('2026-06-22'),
      coverImage: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80',
      translations: {},
    },
    {
      slug: 'coming-soon-helpernear-app',
      title: 'HelperNear Mobile App Coming Soon!',
      excerpt: 'We are working on our native mobile app for Android and iOS. Stay tuned for the launch announcement.',
      content: `<p>We have been listening to our users, and the most requested feature has been a native mobile app. We are excited to announce that the HelperNear mobile app is currently in development!</p><h2>What to Expect</h2><ul><li>Real-time worker tracking on a map</li><li>Instant booking and scheduling</li><li>In-app chat with workers</li><li>Push notifications for bookings and offers</li><li>Digital payment integration</li></ul><h2>Launch Timeline</h2><p>We are targeting a Q3 2026 launch on both Android (Play Store) and iOS (App Store). Sign up for our newsletter to be the first to know.</p>`,
      author: 'HelperNear Team',
      isPublished: false,
      coverImage: null,
      translations: {},
    },
  ];

  for (const p of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: { title: p.title, content: p.content, isPublished: p.isPublished },
      create: p,
    });
  }
  console.log('✅ Blog posts (5 published, 1 draft)');

  // ── Pages ────────────────────────────────────────────────────────────────────
  const pages = [
    {
      slug: 'about-us',
      title: 'About HelperNear',
      content: `<h2>Our Story</h2><p>HelperNear was founded in 2026 with a simple mission: make it easy and safe for people to find skilled local workers for home services.</p><p>We noticed that finding a reliable plumber, electrician or maid was still a word-of-mouth process fraught with uncertainty. We decided to change that.</p><h2>Our Mission</h2><p>To connect every household with verified, skilled, and trustworthy local workers — quickly and transparently.</p><h2>Our Values</h2><ul><li><strong>Trust:</strong> Every worker is verified before they can appear on the platform.</li><li><strong>Transparency:</strong> Real reviews, real prices, no hidden fees.</li><li><strong>Local:</strong> We believe in supporting local skilled workers and their livelihoods.</li></ul><h2>Our Team</h2><p>We are a small but passionate team based in Delhi NCR, building technology to empower both homeowners and skilled workers across India.</p>`,
      isActive: true,
      translations: { hi: { title: 'HelperNear के बारे में', content: '<h2>हमारी कहानी</h2><p>HelperNear की स्थापना 2026 में एक सरल मिशन के साथ की गई थी।</p>' } },
    },
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      content: `<h2>1. Information We Collect</h2><p>We collect information you provide directly to us, including your name, phone number, email address, and location when you use our services.</p><h2>2. How We Use Your Information</h2><p>We use the information we collect to provide, maintain and improve our services, process transactions, send notifications, and respond to your requests.</p><h2>3. Information Sharing</h2><p>We do not sell, trade, or rent your personal information to third parties. We may share your information only as described in this policy, including with workers you choose to contact.</p><h2>4. Location Data</h2><p>We use your location to show you nearby workers. Location data is not stored permanently and is only used to deliver the core service.</p><h2>5. Data Security</h2><p>We implement appropriate technical and organisational measures to protect your personal information against accidental or unlawful destruction, loss, alteration or unauthorised disclosure.</p><h2>6. Your Rights</h2><p>You have the right to access, correct, or delete your personal information at any time by contacting us at support@helpernear.com.</p><h2>7. Contact Us</h2><p>If you have any questions about this Privacy Policy, please contact us at support@helpernear.com.</p><p><em>Last updated: June 2026</em></p>`,
      isActive: true,
      translations: {},
    },
    {
      slug: 'terms-of-service',
      title: 'Terms of Service',
      content: `<h2>1. Acceptance of Terms</h2><p>By accessing or using HelperNear, you agree to be bound by these Terms of Service. If you do not agree with these terms, please do not use our platform.</p><h2>2. Service Description</h2><p>HelperNear is a platform that connects customers with local service workers. We do not employ the workers listed on our platform — they are independent service providers.</p><h2>3. User Responsibilities</h2><ul><li>Provide accurate information when registering</li><li>Use the platform only for lawful purposes</li><li>Do not misuse or attempt to circumvent our verification system</li></ul><h2>4. Worker Listings</h2><p>While we verify workers before listing them, we cannot guarantee the quality of their work. We encourage users to check reviews and ratings before hiring.</p><h2>5. Reviews</h2><p>Reviews must be honest and based on actual service experiences. Fake reviews or defamatory content will be removed.</p><h2>6. Limitation of Liability</h2><p>HelperNear is not liable for any damages arising from transactions between customers and workers facilitated through our platform.</p><h2>7. Changes to Terms</h2><p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p><p><em>Last updated: June 2026</em></p>`,
      isActive: true,
      translations: {},
    },
    {
      slug: 'refund-policy',
      title: 'Refund Policy',
      content: `<h2>Overview</h2><p>HelperNear acts as a marketplace between customers and independent workers. Refunds are handled on a case-by-case basis.</p><h2>When You May Request a Refund</h2><ul><li>Worker did not show up after confirmed booking</li><li>Work quality was significantly below what was agreed</li><li>Worker charged more than the agreed price</li></ul><h2>How to Raise a Refund Request</h2><p>Contact our support team at support@helpernear.com within 48 hours of the service with details of the issue. We will review your complaint and respond within 3 business days.</p><h2>Resolution Process</h2><p>Our team will investigate the complaint, speak to both parties, and determine an appropriate resolution. This may include a refund, credit, or worker action.</p><p><em>Last updated: June 2026</em></p>`,
      isActive: true,
      translations: {},
    },
  ];

  for (const p of pages) {
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: { title: p.title, content: p.content },
      create: p,
    });
  }
  console.log('✅ Pages (4: About, Privacy, Terms, Refund)');

  // ── Notification Templates ────────────────────────────────────────────────────
  const notifTemplates = [
    {
      name: 'otp_sms', type: 'SMS', subject: null,
      body: 'Your HelperNear OTP is {{otp}}. Valid for 10 minutes. Do not share this with anyone.',
      variables: 'otp',
    },
    {
      name: 'worker_verified_email', type: 'EMAIL', subject: 'Your HelperNear profile has been verified!',
      body: 'Hi {{workerName}}, Great news! Your HelperNear profile has been verified. You are now visible to customers searching for {{category}} workers near you. Start getting calls today!',
      variables: 'workerName, category',
    },
    {
      name: 'new_review_sms', type: 'SMS', subject: null,
      body: 'You received a new {{rating}}-star review on HelperNear! Open the app to see it.',
      variables: 'rating',
    },
    {
      name: 'welcome_customer_email', type: 'EMAIL', subject: 'Welcome to HelperNear!',
      body: 'Hi {{name}}, Welcome to HelperNear! You can now find verified workers for all your home service needs. Start exploring workers near you at helpernear.com/app',
      variables: 'name',
    },
  ];

  for (const t of notifTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
  console.log('✅ Notification templates (4)');

  // ── Activity Logs ─────────────────────────────────────────────────────────────
  const activityLogs = [
    { action: 'WORKER_VERIFIED', target: 'Raju Plumber', details: 'Profile manually verified after document check' },
    { action: 'WORKER_VERIFIED', target: 'Suresh Kumar', details: 'Verified – electrician certificate confirmed' },
    { action: 'WORKER_BLOCKED', target: 'Old Worker XYZ', details: 'Blocked due to 3 unresolved complaints' },
    { action: 'BLOG_CREATED', target: 'How to Find a Reliable Plumber', details: 'New blog post published' },
    { action: 'COUPON_CREATED', target: 'FIRST100', details: 'Flat ₹100 discount coupon created' },
    { action: 'COMPLAINT_RESOLVED', target: 'Complaint #3', details: 'Refund issued to Neha Gupta' },
    { action: 'SETTINGS_UPDATED', target: 'App Settings', details: 'Maintenance mode toggled OFF' },
    { action: 'BANNER_CREATED', target: 'Festive Season Banner', details: 'New promotional banner added' },
  ];

  for (const log of activityLogs) {
    await prisma.activityLog.create({
      data: { adminId: 'seed', adminName: 'Super Admin', ...log },
    });
  }
  console.log('✅ Activity logs (8)');

  // ── Contact Submissions ───────────────────────────────────────────────────────
  const contactSubs = [
    { name: 'Arun Mishra', email: 'arun@example.com', phone: '+919900001111', subject: 'Partnership Inquiry', message: 'Hi, I run a plumbing business in Pune and would like to list my workers on HelperNear. Can you please share the process?' },
    { name: 'Kavya Reddy', email: 'kavya@example.com', phone: '+919900002222', subject: 'Worker Not Showing Up', message: 'I booked Raju Plumber for 10am but he has not come yet. It is 11:30am now. Please help!', isRead: true },
    { name: 'Tech Blog India', email: 'editor@techblog.in', subject: 'PR / Media Inquiry', message: 'We are writing an article about home services startups in India. Would love to feature HelperNear. Please connect us with your PR team.' },
    { name: 'Santosh Nair', email: 'santosh@example.com', phone: '+919900003333', subject: 'Feature Request', message: 'Please add a scheduling feature so I can book workers for a specific date and time in advance. This would be very useful!', isRead: true },
  ];

  for (const c of contactSubs) {
    await prisma.contactSubmission.create({ data: c });
  }
  console.log('✅ Contact submissions (4)');

  // ── Default Settings ──────────────────────────────────────────────────────────
  const defaultSettings = [
    { key: 'static_otp_enabled', value: 'true', label: 'Enable Static OTP', description: 'When ON, every user receives OTP 8989 (for testing only)', group: 'otp', isSecret: false },
    { key: 'static_otp_value', value: '8989', label: 'Static OTP Value', description: 'The fixed OTP code used when static OTP is enabled', group: 'otp', isSecret: false },
    { key: 'twilio_account_sid', value: '', label: 'Twilio Account SID', description: 'Your Twilio account SID from console.twilio.com', group: 'twilio', isSecret: false },
    { key: 'twilio_auth_token', value: '', label: 'Twilio Auth Token', description: 'Your Twilio auth token', group: 'twilio', isSecret: true },
    { key: 'twilio_phone_number', value: '', label: 'Twilio Phone Number', description: 'Your Twilio sender phone number', group: 'twilio', isSecret: false },
    { key: 'smtp_host', value: '', label: 'SMTP Host', description: 'e.g. smtp.gmail.com', group: 'smtp', isSecret: false },
    { key: 'smtp_port', value: '587', label: 'SMTP Port', description: 'Usually 587 (TLS) or 465 (SSL)', group: 'smtp', isSecret: false },
    { key: 'smtp_user', value: '', label: 'SMTP Username', description: 'Your email address or SMTP login', group: 'smtp', isSecret: false },
    { key: 'smtp_password', value: '', label: 'SMTP Password', description: 'Your SMTP password or app password', group: 'smtp', isSecret: true },
    { key: 'smtp_from', value: 'HelperNear <noreply@helpernear.com>', label: 'From Address', description: 'Sender name and email shown to recipients', group: 'smtp', isSecret: false },
    { key: 'app_name', value: 'HelperNear', label: 'App Name', description: 'Displayed in emails and notifications', group: 'app', isSecret: false },
    { key: 'support_email', value: 'support@helpernear.com', label: 'Support Email', description: 'Contact email shown to users', group: 'app', isSecret: false },
    { key: 'maintenance_mode', value: 'false', label: 'Maintenance Mode', description: 'When ON, API returns 503 for all requests', group: 'app', isSecret: false },
    { key: 'fcm_project_id', value: '', label: 'Firebase Project ID', group: 'firebase', isSecret: false },
    { key: 'fcm_client_email', value: '', label: 'Service Account Email', group: 'firebase', isSecret: false },
    { key: 'fcm_private_key', value: '', label: 'Service Account Private Key', group: 'firebase', isSecret: true },
    { key: 'fcm_api_key', value: '', label: 'Firebase Web API Key', group: 'firebase', isSecret: false },
    { key: 'fcm_app_id', value: '', label: 'Firebase App ID', group: 'firebase', isSecret: false },
    { key: 'fcm_messaging_sender_id', value: '', label: 'Firebase Messaging Sender ID', group: 'firebase', isSecret: false },
    { key: 'fcm_vapid_key', value: '', label: 'VAPID Key', description: 'Web Push certificate key from Firebase Console → Cloud Messaging', group: 'firebase', isSecret: false },
    { key: 'fcm_auth_domain', value: '', label: 'Firebase Auth Domain', group: 'firebase', isSecret: false },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { label: s.label, description: s.description ?? null, group: s.group, isSecret: s.isSecret },
      create: { ...s, description: s.description ?? null },
    });
  }
  console.log('✅ Settings seeded (static OTP enabled for testing: 8989)');

  console.log('\n🎉 All done! Database fully seeded.');
  console.log('══════════════════════════════════════════════════');
  console.log('  Admin panel  → http://localhost:3000/admin');
  console.log('  Email        : admin@helpernear.com');
  console.log('  Password     : Admin@123');
  console.log('──────────────────────────────────────────────────');
  console.log('  Customer app → http://localhost:3000/app');
  console.log('  OTP login    : use any phone above, OTP = 8989');
  console.log('  Test phones  : +911111111111 to +915555555555');
  console.log('──────────────────────────────────────────────────');
  console.log('  Landing page → http://localhost:3000');
  console.log('  Blog         → http://localhost:3000/blog.html');
  console.log('══════════════════════════════════════════════════');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
