`timescale 1ns/1ps
module sar_accel_top_tb;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst, start, valid_in, ready_out;
    reg [7:0] pixel1_in, pixel2_in, threshold;
    wire ready_in, busy, done, valid_out, change_pixel;
    wire [7:0] enhanced_pixel;
    integer errors;

    sar_accel_top #(.IMAGE_WIDTH(3), .IMAGE_HEIGHT(3), .COORD_WIDTH(16)) dut (
        .clk(clk), .rst(rst), .start(start), .valid_in(valid_in),
        .ready_in(ready_in), .pixel1_in(pixel1_in), .pixel2_in(pixel2_in),
        .threshold(threshold), .busy(busy), .done(done),
        .valid_out(valid_out), .ready_out(ready_out),
        .enhanced_pixel(enhanced_pixel), .change_pixel(change_pixel)
    );

    task send_pair;
        input [7:0] a, b;
        begin
            @(negedge clk);
            valid_in=1'b1; pixel1_in=a; pixel2_in=b;
            while (ready_in !== 1'b1) @(negedge clk);
            @(posedge clk); #1;
        end
    endtask

    initial begin
        errors=0; rst=1; start=0; valid_in=0; ready_out=0;
        pixel1_in=0; pixel2_in=0; threshold=0;
        repeat (2) @(posedge clk);
        @(negedge clk); rst=0; start=1;
        @(posedge clk); #1; start=0;

        // Image 1 is 1..9. Image 2 has a center impulse of 200.
        // Their medians are 5 and 6, so threshold 0 must mark a change.
        send_pair(1,1); send_pair(2,2); send_pair(3,3);
        send_pair(4,4); send_pair(5,200); send_pair(6,6);
        send_pair(7,7); send_pair(8,8); send_pair(9,9);
        @(negedge clk); valid_in=0;

        wait (valid_out === 1'b1);
        #1;
        if (enhanced_pixel !== 8'd6 || change_pixel !== 1'b1 || done !== 1'b0) begin
            $display("FAIL top output expected enhanced=6 change=1 got enhanced=%0d change=%b done=%b",
                     enhanced_pixel,change_pixel,done);
            errors=errors+1;
        end

        // Output must remain stable while receiver is stalled.
        repeat (2) begin
            @(posedge clk); #1;
            if (valid_out!==1'b1 || enhanced_pixel!==8'd6 || change_pixel!==1'b1 || done!==1'b0) begin
                $display("FAIL top output did not hold during stall"); errors=errors+1;
            end
        end

        @(negedge clk); ready_out=1;
        @(posedge clk); #1;
        if (valid_out!==1'b0 || done!==1'b1 || busy!==1'b0) begin
            $display("FAIL final status valid=%b done=%b busy=%b",valid_out,done,busy);
            errors=errors+1;
        end

        if (errors==0) $display("PASS: sar_accel_top_tb");
        else $display("FAIL: %0d error(s)",errors);
        $finish;
    end
endmodule
