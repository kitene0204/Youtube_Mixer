const K = ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>;

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>
          ✕
        </button>
        <h2>사용법</h2>
        <div className="help-grid">
          <div>
            <h3>스크래치</h3>
            <p>
              조그 휠 <b>윗면</b>을 마우스로 잡고 앞뒤로 문지르면 판을 손으로 긁는 것처럼 소리가 납니다. 손을 멈추면 소리도 멈춰요.
              <br />
              <b>바깥 테두리</b>를 돌리면 스크래치 대신 속도만 살짝 밀고 당깁니다(박자 맞출 때).
            </p>
            <p className="note">
              <b>파일·데모 곡</b>은 그 곡 자체를 진짜로 긁어요.
              <br />
              <b>유튜브</b>는 브라우저 보안 때문에 소리를 직접 만질 수 없어서, 휠을 잡는 동안 유튜브 소리를 끄고 "아~ / 프레쉬" 스크래치 목소리를 긁습니다. (SAMPLER 모드에서 내 샘플로 바꿀 수 있어요)
            </p>
          </div>
          <div>
            <h3>버튼</h3>
            <ul>
              <li>
                <b>CUE</b> — 멈춘 상태에서 누르면 그 자리를 기억, 재생 중에 누르면 그 자리로 돌아가 멈춤, 기억한 자리에서 누르고 있으면 누르는 동안만 재생
              </li>
              <li>
                <b>BEAT SYNC</b> — 다른 데크 빠르기(BPM)에 맞춤
              </li>
              <li>
                <b>TAP</b> — 유튜브 곡은 BPM을 모르니 박자에 맞춰 4번 이상 톡톡
              </li>
              <li>
                <b>IN / OUT</b> — 원하는 구간 반복 (SHIFT+IN = 4박 반복)
              </li>
              <li>
                <b>CFX</b> — 왼쪽으로 돌리면 먹먹하게, 오른쪽으로 돌리면 가볍게
              </li>
              <li>
                <b>X-FADER SCRATCH</b> — 크로스페이더를 살짝만 움직여도 소리가 확 켜지고 꺼져요 (스크래치용)
              </li>
              <li>
                <b>🔍 비슷한 영상 찾기</b> — 저작권자가 임베드를 막아둔 영상(오류 101/150)일 때 떠요. 누르면 같은 제목으로 임베드 가능한
                다른 업로드를 찾아 보여줘요. (유튜브 API 키를 설정해야 보여요 — README 참고)
              </li>
            </ul>
          </div>
        </div>
        <h2>키보드</h2>
        <div className="help-grid keys">
          <div>
            <h3>DECK 1 (왼손)</h3>
            <p>
              <K>A</K> 뒤로 / <K>F</K> 앞으로 스크래치 (누르고 있는 동안)
            </p>
            <p>
              <K>E</K> <K>D</K> 볼륨 올림·내림
            </p>
            <p>
              <K>S</K> 재생/정지 · <K>Q</K> CUE · <K>W</K> SYNC
            </p>
            <p>
              <K>1</K>
              <K>2</K>
              <K>3</K>
              <K>4</K> 핫큐 (Shift+숫자 = 지우기)
            </p>
          </div>
          <div>
            <h3>DECK 2 (오른손)</h3>
            <p>
              <K>←</K> 뒤로 / <K>→</K> 앞으로 스크래치
            </p>
            <p>
              <K>↑</K> <K>↓</K> 볼륨 올림·내림
            </p>
            <p>
              <K>End</K> 재생/정지 · <K>PgDn</K> CUE · <K>Enter</K> SYNC
            </p>
            <p>
              <K>Insert</K>
              <K>Home</K>
              <K>PgUp</K>
              <K>Delete</K> 핫큐
            </p>
          </div>
          <div>
            <h3>믹서</h3>
            <p>
              <K>왼쪽 Ctrl</K> / <K>오른쪽 Ctrl</K> 크로스페이더 이동
            </p>
            <p>
              <K>Space</K> 크로스페이더 가운데로
            </p>
            <p className="note">노브는 위아래로 끌기·마우스 휠, 더블클릭하면 원래 자리로 돌아가요. Shift를 누르고 끌면 미세 조정.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
