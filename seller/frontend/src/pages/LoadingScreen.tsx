import React from 'react';
import styled from 'styled-components';

interface LoaderProps {
  /** Duration in seconds for the drive animation. 
   *  Pass a small number (e.g. 1) for a fast drive, larger (e.g. 6) for a slow drive.
   *  Default is 4 (keeps previous behavior).
   */
  duration?: number;
}

const Loader: React.FC<LoaderProps> = ({ duration = 4 }) => {
  return (
    <StyledWrapper style={{ ['--drive-duration' as any]: `${duration}s` }}>
      <div className="loader">
        <div className="scene">
          {/* Yellow Car from HTML */}
          <div className="carContainer">
            <div className="yellowCar">
              <img src="https://i.imgur.com/n947rWL.png" alt="Yellow Car" className="carBody" />
              <div className="wheels">
                <img src="https://i.imgur.com/uZh01my.png" alt="Wheel" className="frontWheel" />
                <img src="https://i.imgur.com/uZh01my.png" alt="Wheel" className="backWheel" />
              </div>
            </div>
          </div>

          {/* Parking Slot */}
          <div className="parkingSlot">
            <div className="slotBorder"></div>
            <div className="pSign">P</div>
            <div className="parkingLines">
              <div className="line"></div>
              <div className="line"></div>
            </div>
          </div>

          {/* Road */}
          <div className="road">
            <div className="roadMark"></div>
            <div className="roadMark"></div>
            <div className="roadMark"></div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  /* drive duration controlled by CSS variable --drive-duration (e.g. "2s", "4s") */
  .loader {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .scene {
    width: 300px;
    height: 120px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* Yellow Car Container */
  .carContainer {
    position: absolute;
    left: -120px;
    bottom: 20px;
    /* use CSS variable --drive-duration to allow dynamic speed control from React */
    animation: driveToParking var(--drive-duration, 4s) ease-in-out forwards;
    z-index: 10;
  }

  .yellowCar {
    position: relative;
    width: 120px;
    height: auto;
    filter: drop-shadow(2px 4px 8px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 15px rgba(255, 215, 0, 0.3));
  }

  .carBody {
    width: 100%;
    height: auto;
    animation: carBounce 1s linear infinite;
  }

  @keyframes carBounce {
    0% { transform: translateY(-2px); }
    50% { transform: translateY(0px); }
    100% { transform: translateY(-2px); }
  }

  .wheels {
    position: absolute;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* wheel spin derives from drive duration so wheel speed matches car speed */
  .frontWheel, .backWheel {
    position: absolute;
    width: 18px;
    height: 18px;
    animation: wheelSpin calc(var(--drive-duration, 4s) * 0.075) linear infinite;
  }

  .frontWheel {
    right: 20px;
    bottom: 0px;
  }

  .backWheel {
    left: 20px;
    bottom: 0px;
  }

  @keyframes wheelSpin {
    100% { transform: rotate(360deg); }
  }

  @keyframes driveToParking {
    0% {
      transform: translateX(0px) scale(1);
      left: -120px;
    }
    15% {
      transform: translateX(50px) scale(1);
    }
    30% {
      transform: translateX(120px) scale(1);
    }
    45% {
      transform: translateX(180px) scale(1);
    }
    60% {
      transform: translateX(220px) scale(0.9);
      left: -120px;
    }
    75% {
      transform: translateX(240px) scale(0.85);
      left: -100px;
    }
    85% {
      transform: translateX(250px) scale(0.8);
      left: -80px;
    }
    95% {
      transform: translateX(255px) scale(0.75);
      left: -60px;
    }
    100% {
      transform: translateX(260px) scale(0.7);
      left: -40px;
    }
  }

  /* Enhanced Car Shadow */
  .carContainer::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    width: 80px;
    height: 5px;
    background: linear-gradient(90deg, rgba(255, 215, 0, 0.3), rgba(255, 165, 0, 0.2), rgba(255, 215, 0, 0.3));
    border-radius: 50%;
    transform: translateX(-50%);
    filter: blur(3px);
    animation: enhancedCarShadow var(--drive-duration, 4s) ease-in-out forwards;
  }

  @keyframes enhancedCarShadow {
    0% {
      transform: translateX(-50%) scale(1.2);
      opacity: 0.4;
    }
    60% {
      transform: translateX(-50%) scale(1);
      opacity: 0.6;
    }
    85% {
      transform: translateX(-50%) scale(0.8);
      opacity: 0.7;
    }
    100% {
      transform: translateX(-50%) scale(0.6);
      opacity: 0.8;
    }
  }

  /* Parking Slot */
  .parkingSlot {
    position: absolute;
    right: 50px;
    bottom: 15px;
    width: 80px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
  }

  .slotBorder {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px dashed #3B82F6;
    border-radius: 8px;
    animation: slotPulse 2s ease-in-out infinite;
  }

  @keyframes slotPulse {
    0%, 100% {
      border-color: #3B82F6;
      opacity: 1;
      transform: scale(1);
    }
    50% {
      border-color: #60A5FA;
      opacity: 0.8;
      transform: scale(1.02);
    }
  }

  .pSign {
    font-size: 32px;
    font-weight: 900;
    color: #3B82F6;
    font-family: 'Arial Black', sans-serif;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 10px rgba(59, 130, 246, 0.3);
    animation: signGlowEnhanced 2s ease-in-out infinite;
    z-index: 6;
  }

  @keyframes signGlowEnhanced {
    0%, 100% {
      transform: scale(1);
      color: #3B82F6;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 10px rgba(59, 130, 246, 0.3);
    }
    50% {
      transform: scale(1.1);
      color: #60A5FA;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 15px rgba(96, 165, 250, 0.5);
    }
  }

  .parkingLines {
    position: absolute;
    bottom: 8px;
    width: 100%;
    display: flex;
    justify-content: space-around;
    padding: 0 15px;
    z-index: 6;
  }

  .line {
    width: 20px;
    height: 3px;
    background: linear-gradient(90deg, #3B82F6, #60A5FA);
    border-radius: 2px;
    opacity: 0.7;
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
  }

  /* Road */
  .road {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #64748B;
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
  }

  .roadMark {
    width: 15px;
    height: 2px;
    background: #F1F5F9;
    /* road animation scales with drive duration so it visually matches speed */
    animation: roadMove calc(var(--drive-duration, 4s) * 0.375) linear infinite;
  }

  .roadMark:nth-child(1) { animation-delay: 0s; }
  .roadMark:nth-child(2) { animation-delay: 0.5s; }
  .roadMark:nth-child(3) { animation-delay: 1s; }

  @keyframes roadMove {
    0% {
      transform: translateX(-100px);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translateX(100px);
      opacity: 0;
    }
  }

  /* Additional beautiful effects */
  .scene::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
    pointer-events: none;
    z-index: 1;
  }
`;

export default Loader;