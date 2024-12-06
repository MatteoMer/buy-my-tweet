'use client'
import { useRouter } from 'next/navigation';

const Home = () => {

    const router = useRouter();
    const handleNavigation = (path: string) => {
        router.push(path);
    };

    return (
        <div >
            <h1>Buy a X post</h1>

            <div>
                <div >
                    <button style={{ marginRight: "4px" }} onClick={() => handleNavigation('/register')}>
                        Register
                    </button>
                    <button style={{ marginRight: "4px" }} onClick={() => handleNavigation('/buy-tweet')}>
                        Buy Tweet
                    </button>
                    <button onClick={() => handleNavigation('/redeem-money')}>
                        Redeem Money
                    </button>
                </div>
            </div>

        </div >
    );
};

export default Home;
