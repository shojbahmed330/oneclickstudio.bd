export interface ErrorKnowledgeEntry {
  id: string;
  pattern: string | RegExp;
  category: 'syntax' | 'type' | 'import' | 'runtime' | 'config';
  rootCause: string;
  solutionInstruction: string;
}

export class ErrorAnalyzer {
  public static analyze(error: string, knowledgeBase: ErrorKnowledgeEntry[]): { rootCause: string; solution: string } | null {
    for (const entry of knowledgeBase) {
      if (typeof entry.pattern === 'string') {
        if (error.includes(entry.pattern)) {
          return { rootCause: entry.rootCause, solution: entry.solutionInstruction };
        }
      } else {
        const match = error.match(entry.pattern);
        if (match) {
          let rootCause = entry.rootCause;
          let solution = entry.solutionInstruction;

          // Replace placeholders like $1, $2 with captured groups
          match.forEach((val, idx) => {
            if (idx === 0) return;
            const placeholder = new RegExp(`\\$${idx}`, 'g');
            rootCause = rootCause.replace(placeholder, val);
            solution = solution.replace(placeholder, val);
          });

          return { rootCause, solution };
        }
      }
    }
    return null;
  }
}

export const ERROR_KNOWLEDGE_BASE: ErrorKnowledgeEntry[] = [
  {
    id: 'missing_import_target',
    pattern: /Missing import target: "([^"]+)" in "([^"]+)"/,
    category: 'import',
    rootCause: 'আপনি "$1" ফাইলটি ইমপোর্ট করার চেষ্টা করেছেন যা "$2" ফাইলের সাপেক্ষে খুঁজে পাওয়া যাচ্ছে না।',
    solutionInstruction: 'দয়া করে নিশ্চিত করুন যে "$1" ফাইলটি সঠিক পাথে আছে। যদি ফাইলটি না থাকে, তবে সেটি তৈরি করুন অথবা ইমপোর্ট পাথটি ঠিক করুন।'
  },
  {
    id: 'jsx_in_ts_extension',
    pattern: /File "([^"]+)" contains JSX\/HTML tags but has a \.ts extension/,
    category: 'syntax',
    rootCause: '"$1" ফাইলে JSX কোড ব্যবহার করা হয়েছে, যা শুধুমাত্র .tsx ফাইলে অনুমোদিত।',
    solutionInstruction: 'এই ফাইলটির এক্সটেনশন .ts থেকে পরিবর্তন করে .tsx করুন।'
  },
  {
    id: 'property_not_exists',
    pattern: /Property '([^']+)' does not exist on type '([^']+)'/,
    category: 'type',
    rootCause: 'আপনি "$1" প্রপার্টি অ্যাক্সেস করার চেষ্টা করছেন যা "$2" টাইপ বা ইন্টারফেসে ডিফাইন করা নেই।',
    solutionInstruction: '"$2" ইন্টারফেস বা টাইপ ডেফিনিশনটি চেক করুন এবং "$1" প্রপার্টিটি যুক্ত করুন অথবা সঠিক প্রপার্টি নাম ব্যবহার করুন।'
  },
  {
    id: 'module_not_found',
    pattern: /Cannot find module '([^']+)' or its corresponding type declarations/,
    category: 'import',
    rootCause: 'আপনি "$1" লাইব্রেরি ইমপোর্ট করেছেন যা ইনস্টল করা নেই অথবা টাইপ ডেফিনিশন মিসিং।',
    solutionInstruction: 'নিশ্চিত করুন যে "$1" প্যাকেজটি package.json-এ আছে। যদি এটি একটি লোকাল ফাইল হয়, তবে পাথটি পুনরায় চেক করুন।'
  },
  {
    id: 'default_export_mismatch',
    pattern: /Default import mismatch: You imported "([^"]+)" as default from "([^"]+)"/,
    category: 'import',
    rootCause: 'আপনি "$2" ফাইল থেকে "$1" কে ডিফল্ট ইমপোর্ট করার চেষ্টা করছেন কিন্তু ওই ফাইলে কোনো ডিফল্ট এক্সপোর্ট নেই।',
    solutionInstruction: '"$2" ফাইলটিতে export default যোগ করুন অথবা কার্লি ব্রেস { } ব্যবহার করে নেমড ইমপোর্ট (Named Import) করুন।'
  },
  {
    id: 'variable_not_found',
    pattern: /Cannot find name '([^']+)'/,
    category: 'syntax',
    rootCause: '"$1" নামে কোনো ভেরিয়েবল, ফাংশন বা কম্পোনেন্ট খুঁজে পাওয়া যাচ্ছে না।',
    solutionInstruction: 'নিশ্চিত করুন যে "$1" ডিফাইন করা হয়েছে অথবা সঠিক ফাইল থেকে ইমপোর্ট করা হয়েছে। বানানটি পুনরায় চেক করুন।'
  },
  {
    id: 'type_mismatch',
    pattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
    category: 'type',
    rootCause: '"$1" টাইপের ডাটা "$2" টাইপের ভেরিয়েবলে রাখার চেষ্টা করা হচ্ছে, যা টাইপস্ক্রিপ্টে অনুমোদিত নয়।',
    solutionInstruction: 'ডাটার টাইপ পরিবর্তন করুন অথবা ইন্টারফেসটি আপডেট করুন যাতে এটি "$1" টাইপ গ্রহণ করতে পারে।'
  },
  {
    id: 'missing_required_prop',
    pattern: /Property '([^']+)' is missing in type '([^']+)' but required in type '([^']+)'/,
    category: 'type',
    rootCause: '"$3" ইন্টারফেসে "$1" প্রপার্টিটি বাধ্যতামূলক (Required), কিন্তু আপনি এটি প্রদান করেননি।',
    solutionInstruction: 'কম্পোনেন্ট বা অবজেক্টে "$1" প্রপার্টিটি অবশ্যই যুক্ত করুন অথবা ইন্টারফেসে এটিকে অপশনাল (Optional) হিসেবে চিহ্নিত করুন।'
  },
  {
    id: 'async_await_error',
    pattern: /'await' expressions are only allowed within async functions/,
    category: 'syntax',
    rootCause: 'আপনি একটি সাধারণ ফাংশনের ভেতরে "await" ব্যবহার করেছেন।',
    solutionInstruction: 'ফাংশনটির আগে "async" কিওয়ার্ড যুক্ত করুন (যেমন: async function ...)।'
  },
  {
    id: 'syntax_error_unexpected_token',
    pattern: /Unexpected token '([^']+)'/,
    category: 'syntax',
    rootCause: 'কোডে "$1" টোকেনটি অপ্রত্যাশিতভাবে এসেছে। সম্ভবত কোনো ব্র্যাকেট বা সেমিকোলন মিসিং আছে।',
    solutionInstruction: 'কোডের স্ট্রাকচারটি পুনরায় চেক করুন এবং নিশ্চিত করুন যে "$1" টোকেনটির আগে বা পরে কোনো সিনট্যাক্স ভুল নেই।'
  },
  {
    id: 'react_hook_rules',
    pattern: /React Hook "([^"]+)" is called (?:at the top level|inside a loop|conditionally)/,
    category: 'runtime',
    rootCause: '"$1" হুকটি ভুল জায়গায় কল করা হয়েছে। রিঅ্যাক্ট হুক শুধুমাত্র ফাংশনাল কম্পোনেন্টের টপ লেভেলে কল করা যায়।',
    solutionInstruction: '"$1" কলটিকে কম্পোনেন্টের একদম শুরুতে নিয়ে আসুন এবং কোনো কন্ডিশন বা লুপের ভেতরে রাখবেন না।'
  },
  {
    id: 'infinite_re_render',
    pattern: /Too many re-renders\. React limits the number of renders to prevent an infinite loop/,
    category: 'runtime',
    rootCause: 'কম্পোনেন্ট রেন্ডার হওয়ার সময় সরাসরি স্টেট আপডেট করা হচ্ছে, যা ইনফিনিট লুপ তৈরি করছে।',
    solutionInstruction: 'স্টেট আপডেট করার জন্য useEffect ব্যবহার করুন অথবা ইভেন্ট হ্যান্ডলারের ভেতরে স্টেট আপডেট করুন।'
  },
  {
    id: 'missing_key_prop',
    pattern: /Each child in a list should have a unique "key" prop/,
    category: 'runtime',
    rootCause: 'ম্যাপ (map) ফাংশন ব্যবহার করে লিস্ট রেন্ডার করার সময় প্রতিটি আইটেমে ইউনিক "key" প্রপ দেওয়া হয়নি।',
    solutionInstruction: 'লিস্টের প্রতিটি এলিমেন্টে একটি ইউনিক ID বা ইনডেক্স "key" হিসেবে যুক্ত করুন।'
  },
  {
    id: 'firebase_permission_denied',
    pattern: /Missing or insufficient permissions/,
    category: 'config',
    rootCause: 'ফায়ারবেস সিকিউরিটি রুলস (Firestore Rules) আপনাকে এই ডাটা অ্যাক্সেস বা রাইট করার অনুমতি দিচ্ছে না।',
    solutionInstruction: 'firestore.rules ফাইলটি চেক করুন এবং নিশ্চিত করুন যে ইউজারের সঠিক পারমিশন আছে। প্রয়োজনে রুলস আপডেট করুন।'
  },
  {
    id: 'invalid_hook_call',
    pattern: /Invalid hook call\. Hooks can only be called inside of the body of a function component/,
    category: 'runtime',
    rootCause: 'আপনি রিঅ্যাক্ট হুক কোনো সাধারণ জাভাস্ক্রিপ্ট ফাংশনের ভেতরে কল করেছেন যা কোনো কম্পোনেন্ট নয়।',
    solutionInstruction: 'নিশ্চিত করুন যে হুকটি একটি ফাংশনাল কম্পোনেন্ট বা কাস্টম হুকের ভেতরে কল করা হয়েছে।'
  }
];

