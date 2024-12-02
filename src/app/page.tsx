'use client'
import Image from "next/image";
import styles from "./page.module.css";
import ReclaimDemo from "./reclaim";
import { useRouter } from 'next/navigation';

const Home = () => {
    const router = useRouter();

    const handleNavigation = (path: string) => {
        router.push(path);
    };

    return (
        <div>
            <h1>Buy a X post</h1>
            <div>
                <button style={{ marginRight: '10px' }} onClick={() => handleNavigation('/buy-tweet')}>
                    Buy Tweet
                </button>
                <button onClick={() => handleNavigation('/redeem-money')}>
                    Redeem Money
                </button>
            </div>
        </div >
    );
};

export default Home;
