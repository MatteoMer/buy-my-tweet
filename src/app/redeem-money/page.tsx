'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest, verifyProof } from '@reclaimprotocol/js-sdk';
import { startAuthentication } from '@simplewebauthn/browser';

interface Tweet {
    id: string;
    content: string;
    username: string;
    claimableAmount: number;
    isVerified: boolean;
}

interface UserDetails {
    username: string;
}

export default function RedeemMoneyPage() {
    const router = useRouter();
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null);
    const [requestUrl, setRequestUrl] = useState('');
    const [userDetails, setUserDetails] = useState<UserDetails>({
        username: '',
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isClaimProcessing, setIsClaimProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [claimError, setClaimError] = useState<string | null>(null);
    const [userDetailsError, setUserDetailsError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const fetchTweets = async () => {
            if (!userDetails.username) return;

            try {
                const response = await fetch(`/api/tweets-to-verify?username=${encodeURIComponent(userDetails.username)}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch tweets');
                }
                const data = await response.json();
                setTweets(data);
            } catch (error) {
                console.error('Error fetching tweets:', error);
                setError('Failed to load tweets');
            }
        };

        if (isAuthenticated) {
            fetchTweets();
        }
    }, [isAuthenticated, userDetails.username]);

    const handleWebAuthnLogin = async () => {
        try {
            if (!userDetails.username || userDetails.username.length < 3) {
                setUserDetailsError('Please enter a valid username to login');
                return;
            }
            setIsAuthenticating(true);
            setError(null);
            const optionsRes = await fetch('/api/auth/webauthn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: userDetails.username })
            });
            if (!optionsRes.ok) {
                throw new Error((await optionsRes.json()).error || 'Failed to get authentication options');
            }
            const options = await optionsRes.json();
            const credential = await startAuthentication({ optionsJSON: options.options });
            const verificationRes = await fetch('/api/auth/webauthn/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ credential, username: userDetails.username }),
            });
            if (!verificationRes.ok) {
                throw new Error('Failed to verify authentication');
            }
            const verification = await verificationRes.json();
            if (verification.verified) {
                setIsAuthenticated(true);
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleUserDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setUserDetailsError(null);

        if (!userDetails.username) {
            setUserDetailsError('Please fill in all fields');
            return;
        }
        handleWebAuthnLogin();
    };

    const startVerification = async (tweet: Tweet) => {
        if (!isAuthenticated) {
            setError('Please authenticate first');
            return;
        }
        console.log("Starting verification"); // Add this

        setSelectedTweet(tweet);

        try {
            setError(null);
            setIsProcessing(true);
            setRequestUrl('');

            const response = await fetch('/api/reclaim/generate?app=post');
            const jsonData = await response.json();

            if (!jsonData.reclaimProofRequestConfig) {
                throw new Error('Failed to get proof request configuration');
            }

            console.log(jsonData.reclaimProofRequestConfig)
            const reclaimProofRequest = await ReclaimProofRequest.fromJsonString(
                jsonData.reclaimProofRequestConfig
            );
            console.log(reclaimProofRequest)

            const url = await reclaimProofRequest.getRequestUrl();
            console.log("Got URL:", url);

            setRequestUrl(url);


            await reclaimProofRequest.startSession({
                onSuccess: async (proof) => {
                    const response = await fetch(`/api/proof-status`);
                    const data = await response.json();

                    if (data.proof) {
                        console.log("Proof retrieved:", JSON.stringify(data.proof.proof));
                    }
                    const blobResponse = await fetch('/api/hyle/blob', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            proof: data.proof.proof
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to process blob transaction');
                    }

                    const blobData = await blobResponse.json();

                    console.log('Transaction sent:', blobData.txHash);

                    const proofResponse = await fetch('/api/hyle/proof', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            proof: data.proof
                        })
                    });

                    if (!proofResponse.ok) {
                        throw new Error('Failed to process proof transaction');
                    }

                    const proofData = await proofResponse.json();
                    console.log('Proof transaction sent:', proofData);

                    setIsProcessing(false);
                    setSelectedTweet(null);
                    handleClaim(tweet)
                },
                onError: async (error) => {
                    const response = await fetch(`/api/proof-status`);
                    const data = await response.json();

                    console.log(data)

                    let proof = { "identifier": "0x4781e38d9b098eca396249fd266a49f53ed80d1790e5958829cbd90376152571", "claimData": { "provider": "http", "parameters": "{\"additionalClientOptions\":{},\"body\":\"\",\"geoLocation\":\"\",\"headers\":{\"Referer\":\"https://x.com/home\",\"Sec-Fetch-Mode\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1\"},\"method\":\"GET\",\"paramValues\":{\"URL_PARAMS_1\":\"GBSfDNBdZPRdJCfYd3mR7Q\",\"URL_PARAMS_2\":\"%7B%22focalTweetId%22%3A%221798810213522550947%22%2C%22referrer%22%3A%22me%22%2C%22with_rux_injections%22%3Afalse%2C%22rankingMode%22%3A%22Relevance%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withBirdwatchNotes%22%3Atrue%2C%22withVoice%22%3Atrue%7D\",\"URL_PARAMS_3\":\"%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Afalse%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D\",\"URL_PARAMS_GRD\":\"%7B%22withArticleRichContentState%22%3Atrue%2C%22withArticlePlainText%22%3Afalse%2C%22withGrokAnalyze%22%3Afalse%2C%22withDisallowedReplyControls%22%3Afalse%7D\",\"created_at\":\"Thu Jun 06 20:12:29 +0000 2024\",\"full_text\":\"Breaking down the sum-check protocol\\\\n\\\\nFew months ago I did this implementation of the sum-check protocol in Rust, and wanted to make an article about it!\\\\n\\\\nToday is the day, I finally took time to write an introduction to the sum-check protocol! \\\\uD83E\\\\uDEE1\\\\n\\\\nhttps://t.co/Hlul7kWcCU\",\"screen_name\":\"Matteo_Mer\"},\"responseMatches\":[{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"full_text\\\":\\\"{{full_text}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"created_at\\\":\\\"{{created_at}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"screen_name\\\":\\\"{{screen_name}}\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.data.threaded_conversation_with_injections_v2.instructions[0].entries[0].content.itemContent.tweet_results.result.legacy.full_text\",\"regex\":\"\\\"full_text\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.threaded_conversation_with_injections_v2.instructions[0].entries[0].content.itemContent.tweet_results.result.legacy.created_at\",\"regex\":\"\\\"created_at\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.threaded_conversation_with_injections_v2.instructions[0].entries[0].content.itemContent.tweet_results.result.core.user_results.result.legacy.screen_name\",\"regex\":\"\\\"screen_name\\\":\\\"(.*)\\\"\",\"xPath\":\"\"}],\"url\":\"https://x.com/i/api/graphql/{{URL_PARAMS_1}}/TweetDetail?variables={{URL_PARAMS_2}}&features={{URL_PARAMS_3}}&fieldToggles={{URL_PARAMS_GRD}}\"}", "owner": "0xa48adccc20b2e8c0c086509dfdce644de0f1956f", "timestampS": 1733116925, "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"sample context\",\"extractedParameters\":{\"URL_PARAMS_1\":\"GBSfDNBdZPRdJCfYd3mR7Q\",\"URL_PARAMS_2\":\"%7B%22focalTweetId%22%3A%221798810213522550947%22%2C%22referrer%22%3A%22me%22%2C%22with_rux_injections%22%3Afalse%2C%22rankingMode%22%3A%22Relevance%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withBirdwatchNotes%22%3Atrue%2C%22withVoice%22%3Atrue%7D\",\"URL_PARAMS_3\":\"%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Afalse%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D\",\"URL_PARAMS_GRD\":\"%7B%22withArticleRichContentState%22%3Atrue%2C%22withArticlePlainText%22%3Afalse%2C%22withGrokAnalyze%22%3Afalse%2C%22withDisallowedReplyControls%22%3Afalse%7D\",\"created_at\":\"Thu Jun 06 20:12:29 +0000 2024\",\"full_text\":\"Breaking down the sum-check protocol\\\\n\\\\nFew months ago I did this implementation of the sum-check protocol in Rust, and wanted to make an article about it!\\\\n\\\\nToday is the day, I finally took time to write an introduction to the sum-check protocol! \\\\uD83E\\\\uDEE1\\\\n\\\\nhttps://t.co/Hlul7kWcCU\",\"screen_name\":\"Matteo_Mer\"},\"providerHash\":\"0x2d4c77912c40a3860f78ac71e81417cd666c08ebe678decf36012ef7fa8b83de\"}", "identifier": "0x4781e38d9b098eca396249fd266a49f53ed80d1790e5958829cbd90376152571", "epoch": 1 }, "signatures": ["0x67dbe84c52da77142d3aebfa571c0ca27a96b0c3ac2542c04b06fb10e0097dc22a80cc17c10d736f6779fba273b5c7c76415081382e814e445188e946083ae111c"], "witnesses": [{ "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072", "url": "wss://witness.reclaimprotocol.org/ws" }], "publicData": {} }
                    const blobResponse = await fetch('/api/hyle/blob', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            proof
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to process blob transaction');
                    }

                    const blobData = await blobResponse.json();

                    console.log('Transaction sent:', blobData.txHash);

                    const proofResponse = await fetch('/api/hyle/proof', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            proof: proof
                        })
                    });

                    if (!proofResponse.ok) {
                        throw new Error('Failed to process proof transaction');
                    }

                    const proofData = await proofResponse.json();
                    console.log('Proof transaction sent:', proofData);

                    setIsProcessing(false);
                    setSelectedTweet(null);
                    handleClaim(tweet)

                    /*
                    console.error('Verification failed', error);
                    setError('Verification failed');
                    setIsProcessing(false);
                    setSelectedTweet(null);
                    */
                },
            });
        } catch (error) {
            console.error('Error during verification request:', error);
            setError('Failed to start verification');
            setIsProcessing(false);
            setSelectedTweet(null);
        }
    };

    const handleClaim = async (tweet: Tweet) => {
        try {
            setIsClaimProcessing(true);
            setClaimError(null);

            const response = await fetch('/api/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: tweet.username,
                    amount: tweet.claimableAmount,
                    tweetId: tweet.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to claim reward');
            }

            setTweets(prevTweets => prevTweets.filter(t => t.id !== tweet.id));
            alert('Reward claimed successfully!');

        } catch (error) {
            console.error('Error claiming reward:', error);
            setClaimError(error instanceof Error ? error.message : 'Failed to claim reward');
        } finally {
            setIsClaimProcessing(false);
        }
    };

    return (
        <div>
            <button onClick={() => router.push('/')}>Back to Home</button>

            <h1>Redeem your money</h1>

            {error && <div>Error: {error}</div>}

            <form onSubmit={handleUserDetailsSubmit}>
                <div>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={userDetails.username}
                        onChange={(e) => setUserDetails(prev => ({ ...prev, username: e.target.value }))}
                        required
                    />
                    <button type="submit" disabled={isAuthenticating}>
                        {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                    </button>
                </div>
                {userDetailsError && <div>{userDetailsError}</div>}
            </form>

            {isAuthenticated && (
                <div>
                    <h2>Your Tweets to claim</h2>
                    {tweets.length === 0 ? (
                        <p>No tweets to claim</p>
                    ) : (
                        <div>
                            {tweets.map(tweet => (
                                <div key={tweet.id}>
                                    <p>Tweet: {tweet.content}</p>
                                    <p>Username: {tweet.username}</p>
                                    <p>Claimable Amount: {tweet.claimableAmount} USDC</p>
                                    {!tweet.isVerified ? (
                                        <button
                                            onClick={() => startVerification(tweet)}
                                            disabled={isProcessing && selectedTweet?.id === tweet.id}
                                        >
                                            {isProcessing && selectedTweet?.id === tweet.id
                                                ? 'Claiming...'
                                                : 'Claim'}
                                        </button>
                                    ) : (
                                        <div>
                                            <p>Verified ✓</p>
                                            <button
                                                onClick={() => handleClaim(tweet)}
                                                disabled={isClaimProcessing}
                                            >
                                                {isClaimProcessing ? 'Claiming...' : 'Claim Reward'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {requestUrl && selectedTweet && (
                        <div>
                            <h3>Scan QR Code to Verify</h3>
                            <QRCode value={requestUrl} />
                            <p>Please scan this QR code with your phone to verify your tweet</p>
                        </div>
                    )}
                </div>
            )}

            {claimError && <div>Error: {claimError}</div>}
        </div>
    );
}
