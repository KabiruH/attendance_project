import { NextRequest, NextResponse } from 'next/server';
import { processOutsideFenceCheckouts } from '@/lib/utils/cronUtils';

export async function GET(request: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Pass current time as argument
    const currentTime = new Date();
    const checkoutCount = await processOutsideFenceCheckouts(currentTime);
    
    return NextResponse.json({
      success: true,
      auto_checkouts: checkoutCount,
      timestamp: currentTime.toISOString(),
    });

  } catch (error) {
    console.error('Auto-checkout cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}